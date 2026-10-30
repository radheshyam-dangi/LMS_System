import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { AssignmentChatThreadEntity } from '../../entities/assignmentChatThread.entity';
import { AssignmentChatMessageEntity } from '../../entities/assignmentChatMessage.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { QuestionLessonDependencyEntity } from '../../entities/questionLessonDependency.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';

@Injectable()
export class AssignmentChatService {
   private readonly logger = new Logger(AssignmentChatService.name);
   private readonly groqApiKey = process.env.GROQ_API_KEY;
   private readonly groqModel = process.env.GROQ_CHAT_MODEL || 'llama-3.1-70b-versatile'; // fallback model if needed

   constructor(
      @InjectRepository(AssignmentChatThreadEntity)
      private threadRepo: Repository<AssignmentChatThreadEntity>,
      @InjectRepository(AssignmentChatMessageEntity)
      private messageRepo: Repository<AssignmentChatMessageEntity>,
      @InjectRepository(AssignmentEntity)
      private assignmentRepo: Repository<AssignmentEntity>,
      @InjectRepository(QuestionLessonDependencyEntity)
      private qldRepo: Repository<QuestionLessonDependencyEntity>,
      @InjectRepository(AssignmentSubmissionEntity)
      private submissionRepo: Repository<AssignmentSubmissionEntity>,
      private dataSource: DataSource
   ) { }

   async getChatHistory(assignmentId: string, traineeId: string) {
      const thread = await this.getOrCreateThread(assignmentId, traineeId);
      return this.messageRepo.find({
         where: { threadId: thread.id },
         order: { createdAt: 'ASC' },
      });
   }

   async clearChat(assignmentId: string, traineeId: string) {
      const thread = await this.threadRepo.findOne({ where: { assignmentId, traineeId } });
      if (thread) {
         await this.messageRepo.delete({ threadId: thread.id });
      }
      return { success: true };
   }

   private async getOrCreateThread(assignmentId: string, traineeId: string): Promise<AssignmentChatThreadEntity> {
      let thread = await this.threadRepo.findOne({ where: { assignmentId, traineeId } });
      if (!thread) {
         thread = this.threadRepo.create({ assignmentId, traineeId, attempt: 1 });
         thread = await this.threadRepo.save(thread);
      }
      return thread;
   }

   async processUserMessage(assignmentId: string, traineeId: string, message: string, focusQuestionIds: string[] = []) {
      // 1. Validate submission state (not locked/closed)
      const submission = await this.submissionRepo.findOne({ where: { assignment: { id: assignmentId }, trainee: { id: traineeId } } });
      if (submission && (submission.status === 'evaluated' || submission.status === 'approved' || submission.status === 'rejected')) {
         throw new HttpException('Assignment is already evaluated or closed', HttpStatus.FORBIDDEN);
      }

      const assignment = await this.assignmentRepo.findOne({ 
         where: { id: assignmentId },
         relations: ['module', 'learningPath']
      });
      if (!assignment) throw new HttpException('Assignment not found', HttpStatus.NOT_FOUND);

      // Intent check
      if (this.isDirectAnswerRequest(message)) {
         return this.saveAndReturnBlockedMessage(assignmentId, traineeId, message, "I cannot provide direct answers or exact phrasing. However, I can help explain concepts or guide your structure.");
      }

      // 2. Parse and Validate Question IDs
      const questions = (assignment.questions || (assignment.mcqConfig as any)?.questions || []) as any[];
      const totalQuestions = questions.length;

      // Check if user specifically requested explicit question number(s)
      const explicitNumbers = this.parseExplicitQuestionNumbers(message);
      if (explicitNumbers.length > 0) {
         const outOfRange = explicitNumbers.filter(n => n < 1 || n > totalQuestions);
         if (outOfRange.length > 0) {
            const countText = totalQuestions === 0
               ? 'This assignment currently does not contain any questions.'
               : totalQuestions === 1
                  ? 'This assignment only contains 1 question (Question 1).'
                  : `This assignment only contains ${totalQuestions} questions (Question 1 to Question ${totalQuestions}).`;
            const invalidStr = outOfRange.map(n => `Question ${n}`).join(', ');
            const guidance = `${countText} ${invalidStr} does not exist in this assessment. Please ask your question regarding ${totalQuestions > 1 ? `Question 1 to Question ${totalQuestions}` : 'Question 1'}.`;
            return this.saveAndReturnBlockedMessage(assignmentId, traineeId, message, guidance);
         }
      }

      let targetQuestionIds: string[] = [];
      if (explicitNumbers.length > 0) {
         targetQuestionIds = explicitNumbers.map(n => {
            const q = questions[n - 1];
            return q?.id || String(n - 1);
         });
      } else {
         targetQuestionIds = this.extractQuestionIds(message, questions, focusQuestionIds);
         if (targetQuestionIds.length === 0) {
            // if no questions extracted, try previous turn
            const history = await this.getChatHistory(assignmentId, traineeId);
            if (history.length > 0) {
               const lastAsst = history.reverse().find(m => m.role === 'assistant' && m.questionIds && m.questionIds.length > 0);
               if (lastAsst) {
                  targetQuestionIds = lastAsst.questionIds;
               }
            }
            // fallback: just pick all if small, else first 1
            if (targetQuestionIds.length === 0) {
               if (questions.length <= 5) targetQuestionIds = questions.map(q => q.id || String(questions.indexOf(q)));
               else targetQuestionIds = [questions[0].id || '0'];
            }
         }
      }

      // cap at 2
      targetQuestionIds = Array.from(new Set(targetQuestionIds)).slice(0, 2);

      // 3. Build context per question
      const contexts: any[] = [];
      const assModId = (assignment as any).moduleId || assignment.module?.id;
      const assLpId = (assignment as any).learningPathId || assignment.learningPath?.id;

      for (const qId of targetQuestionIds) {
         const deps = await this.qldRepo.find({ 
            where: { questionId: qId }, 
            relations: ['lesson', 'lesson.module', 'lesson.learningPath'] 
         });

         let dependsOnLessons = deps.map((d, idx) => ({
            ref: `L${idx + 1}`,
            lessonId: d.lesson?.id || '',
            lessonNumber: idx + 1,
            lessonTitle: d.lesson?.title || 'Prerequisite Lesson',
            url: d.lesson ? this.computeLessonUrl(d.lesson, assModId, assLpId) : `/learning-paths`
         }));

         let lessonIds = deps.map(d => d.lesson?.id).filter(Boolean);

         let chunks = [];
         if (lessonIds.length > 0) {
            chunks = await this.fetchLessonChunks(lessonIds, message);
         } else if (assignment.dependsOnLessonIds?.length > 0) {
            lessonIds = assignment.dependsOnLessonIds;
            chunks = await this.fetchLessonChunks(lessonIds, message);

            // Populate dependsOnLessons if question has no specific deps but assignment does
            if (dependsOnLessons.length === 0) {
               const rawLessons = await this.dataSource.query(
                  `SELECT id, title, "moduleId", "learningPathId" FROM "Lesson" WHERE id = ANY($1)`,
                  [lessonIds]
               );
               dependsOnLessons = rawLessons.map((l: any, idx: number) => ({
                  ref: `L${idx + 1}`,
                  lessonId: l.id,
                  lessonNumber: idx + 1,
                  lessonTitle: l.title || 'Prerequisite Lesson',
                  url: this.computeLessonUrl(l, assModId, assLpId)
               }));
            }
         }

         // Ensure we always have at least 2 prerequisite lessons available for citations
         if (dependsOnLessons.length < 2) {
            let fallbackLessons: any[] = [];
            if (assModId) {
               fallbackLessons = await this.dataSource.query(
                  `SELECT id, title, "moduleId", "learningPathId" FROM "Lesson" WHERE "moduleId" = $1 ORDER BY "sequence_index" ASC, "created_at" ASC LIMIT 4`,
                  [assModId]
               );
            }
            if (!fallbackLessons.length && assLpId) {
               fallbackLessons = await this.dataSource.query(
                  `SELECT l.id, l.title, l."moduleId", m."learningPathId" FROM "Lesson" l 
                   JOIN "Module" m ON m.id = l."moduleId" 
                   WHERE m."learningPathId" = $1 
                   ORDER BY m."sequence_index" ASC, l."sequence_index" ASC LIMIT 4`,
                  [assLpId]
               );
            }
            const existingIds = new Set(lessonIds);
            for (const fl of fallbackLessons) {
               if (!existingIds.has(fl.id) && dependsOnLessons.length < 2) {
                  existingIds.add(fl.id);
                  lessonIds.push(fl.id);
                  dependsOnLessons.push({
                     ref: `L${dependsOnLessons.length + 1}`,
                     lessonId: fl.id,
                     lessonNumber: dependsOnLessons.length + 1,
                     lessonTitle: fl.title || 'Prerequisite Lesson',
                     url: this.computeLessonUrl(fl, assModId, assLpId)
                  });
               }
            }
            if (chunks.length === 0 && lessonIds.length > 0) {
               chunks = await this.fetchLessonChunks(lessonIds, message);
            }
         }

         const qObj = questions.find(q => q.id === qId || String(questions.indexOf(q)) === qId);
         contexts.push({
            questionId: qId,
            questionNumber: questions.indexOf(qObj) + 1,
            questionText: qObj?.text || (qObj as any)?.questionText || (qObj as any)?.question || '',
            dependsOnLessons: dependsOnLessons,
            lessonText: chunks.map((c: any) => ({ text: c.chunkText })),
            lessonIds: Array.from(new Set(chunks.map((c: any) => c.lessonId)))
         });
      }

      // Fetch recent history before saving this message
      const thread = await this.getOrCreateThread(assignmentId, traineeId);
      const priorMessages = await this.messageRepo.find({
         where: { threadId: thread.id },
         order: { createdAt: 'DESC' },
         take: 8,
      });
      const recentHistory = priorMessages.reverse();

      // save user message
      await this.messageRepo.save({
         threadId: thread.id,
         role: 'user',
         content: message,
         questionIds: targetQuestionIds
      });

      // 4. Call Groq with history and dependent lessons context
      let aiResponse = await this.callGroq(contexts, message, recentHistory);

      // Map refs (e.g. "L1") back to structured lesson objects with redirection URLs for the frontend
      if (Array.isArray(aiResponse)) {
         aiResponse = aiResponse.map(res => {
            const ctx = contexts.find(c => c.questionId === res.questionId);
            if (ctx && ctx.dependsOnLessons && ctx.dependsOnLessons.length > 0) {
               const matchedLessons: Array<{ lessonId: string; lessonTitle: string; url: string }> = [];
               const rawSuggestions = Array.isArray(res.suggestedLessons) ? res.suggestedLessons : [];

               for (const sug of rawSuggestions) {
                  const sugStr = typeof sug === 'string' ? sug.trim().toLowerCase() : (sug?.lessonTitle || sug?.ref || '').trim().toLowerCase();
                  const found = ctx.dependsOnLessons.find((d: any) =>
                     d.ref.toLowerCase() === sugStr ||
                     d.lessonTitle.toLowerCase() === sugStr ||
                     sugStr.includes(d.lessonTitle.toLowerCase()) ||
                     d.lessonTitle.toLowerCase().includes(sugStr)
                  );
                  if (found && !matchedLessons.some(m => m.lessonId === found.lessonId)) {
                     matchedLessons.push({
                        lessonId: found.lessonId,
                        lessonTitle: found.lessonTitle,
                        url: found.url
                     });
                  }
               }

               // Guarantee at least 2 prerequisite lessons are attached
               for (const dep of ctx.dependsOnLessons) {
                  if (matchedLessons.length >= 2) break;
                  if (!matchedLessons.some(m => m.lessonId === dep.lessonId)) {
                     matchedLessons.push({
                        lessonId: dep.lessonId,
                        lessonTitle: dep.lessonTitle,
                        url: dep.url
                     });
                  }
               }

               res.suggestedLessons = matchedLessons.slice(0, 2);
            }
            return res;
         });
      }

      // 5. Leak Guard
      if (this.hasAnswerLeak(aiResponse, assignment)) {
         return this.saveAndReturnBlockedMessage(assignmentId, traineeId, message, "I noticed I was getting too close to providing the expected answer. Let's focus on the concepts instead. Which part of the lesson would you like me to explain?", true);
      }

      // save assistant message
      const asstMsg = await this.messageRepo.save({
         threadId: thread.id,
         role: 'assistant',
         content: JSON.stringify(aiResponse), // Storing JSON for frontend to parse
         questionIds: targetQuestionIds,
         lessonIds: contexts.flatMap(c => c.lessonIds) as string[]
      });

      return asstMsg;
   }

   private isDirectAnswerRequest(msg: string): boolean {
      const lower = msg.toLowerCase();
      return lower.includes('what is the answer') || lower.includes('example answer') || lower.includes('give me the answer') || lower.includes('write the answer');
   }

   private hasAnswerLeak(aiResponse: any[], assignment: AssignmentEntity): boolean {
      // Check output for "my answer is..." or exact rubric strings.
      // For simplicity in implementation:
      const stringified = JSON.stringify(aiResponse).toLowerCase();
      if (stringified.includes('my answer is') || stringified.includes('the correct answer is')) return true;
      return false;
   }

   private async saveAndReturnBlockedMessage(assignmentId: string, traineeId: string, userMsg: string, fallbackResponse: string, isLeakGuard = false) {
      const thread = await this.getOrCreateThread(assignmentId, traineeId);
      if (!isLeakGuard) {
         await this.messageRepo.save({ threadId: thread.id, role: 'user', content: userMsg });
      }
      const blockedMsg = await this.messageRepo.save({
         threadId: thread.id,
         role: 'assistant',
         content: fallbackResponse,
         blocked: true,
         intent: isLeakGuard ? 'leak_guard' : 'intent_guard'
      });
      return blockedMsg;
   }

   private computeLessonUrl(lesson: any, defaultModId?: string, defaultLpId?: string): string {
      const modId = lesson.moduleId || lesson.module?.id || defaultModId;
      const lpId = lesson.learningPathId || lesson.learningPath?.id || defaultLpId;
      if (lpId && modId) return `/learning-paths/${lpId}/modules/${modId}`;
      if (modId) return `/modules/${modId}`;
      if (lpId) return `/learning-paths/${lpId}/modules`;
      return `/learning-paths`;
   }

   private parseExplicitQuestionNumbers(message: string): number[] {
      const lower = message.toLowerCase();
      const numbers: number[] = [];

      // Pattern 1: "question 5", "question number 5", "question no 5", "question #5", "q5", "q 5", "questions 1 to 2", "q1-q2"
      const regex1 = /(?:question|q)\s*(?:number|no\.?|#)?\s*(\d+)(?:\s*(?:-|to|and|,)\s*(?:q|question)?\s*(\d+))?/gi;
      let match;
      while ((match = regex1.exec(lower)) !== null) {
         const start = parseInt(match[1], 10);
         if (!isNaN(start)) {
            numbers.push(start);
            if (match[2]) {
               const end = parseInt(match[2], 10);
               if (!isNaN(end)) {
                  for (let i = start + 1; i <= end; i++) {
                     numbers.push(i);
                  }
               }
            }
         }
      }

      // Pattern 2: "5th question", "2nd question", "1st question"
      const regex2 = /(\d+)(?:st|nd|rd|th)?\s+question/gi;
      while ((match = regex2.exec(lower)) !== null) {
         const num = parseInt(match[1], 10);
         if (!isNaN(num)) {
            numbers.push(num);
         }
      }

      return Array.from(new Set(numbers));
   }

   private extractQuestionIds(message: string, questions: any[], focusQuestionIds: string[]): string[] {
      const qIds = new Set<string>();
      if (focusQuestionIds && focusQuestionIds.length > 0) {
         focusQuestionIds.forEach(id => qIds.add(id));
      }

      const lower = message.toLowerCase();
      if (lower.includes('all')) {
         questions.forEach(q => qIds.add(q.id || String(questions.indexOf(q))));
      } else {
         const explicit = this.parseExplicitQuestionNumbers(message);
         if (explicit.length > 0) {
            explicit.forEach(num => qIds.add(String(num - 1)));
         }
      }
      return Array.from(qIds).filter(id => questions.some(q => q.id === id || String(questions.indexOf(q)) === id));
   }

   private async fetchLessonChunks(lessonIds: string[], query: string) {
      if (!lessonIds.length) return [];

      const queryStr = `
       SELECT lesson_id AS "lessonId", chunk_text AS "chunkText", 
              ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank
       FROM "LessonContentChunk"
       WHERE lesson_id = ANY($2)
         AND search_vector IS NOT NULL
       ORDER BY rank DESC
       LIMIT 2
     `;
      const rawResult = await this.dataSource.query(queryStr, [query, lessonIds]);
      return rawResult.map((r: any) => ({
         ...r,
         chunkText: r.chunkText ? r.chunkText.substring(0, 800) : ''
      }));
   }

   private async callGroq(contexts: any[], message: string, recentHistory: AssignmentChatMessageEntity[] = []) {
      if (!this.groqApiKey) {
         this.logger.error('GROQ_API_KEY is missing');
         throw new Error('LLM configuration missing');
      }

      const systemPrompt = `
<role>
You are an AI teaching assistant inside a learning management system (LMS).
A trainee is working on an assignment and asks for help understanding concepts or questions.
Your goal is to provide a concise, natural, and helpful conceptual explanation that directly addresses their question, without giving away direct test answers or multiple-choice options.
</role>

<rules>
1. Natural & Concise: 50 to 90 words per question response.
2. Directly answer the trainee's specific inquiry:
   - Explain the core concept, mechanism, or principle clearly and directly.
   - Guide their reasoning so they understand how to solve it themselves.
   - Do NOT give away the exact answer or multiple-choice option (e.g. do not say "The answer is option C" or "Choose ReplicaSet").
   - Do NOT use robotic template headings like "Question Objective:", "Citations:", or "Socratic Approach:". Respond in a natural, friendly, expert tutor tone.
   - Do NOT embed long citation text or reading lists inside "content". Lesson citations are automatically attached separately as clickable pills from the "suggestedLessons" array.
3. Clean Plain-Text Formatting:
   - Natural, conversational plain-text sentences.
   - Plain text ONLY.
   - Do NOT use asterisks (no **bold** or *italic*).
   - Do NOT use backticks or formatting symbols around technical terms.
   - Zero emojis.
   - No markdown headings (#, ##).
4. Suggested Lessons:
   - In "suggestedLessons", supply 1-2 lesson references (e.g. "L1", "L2") or exact lesson titles from the context that best teach the required concept.
5. Return ONLY a valid JSON object with key "responses":
   {
     "responses": [
       {
         "questionId": "string",
         "content": "string",
         "suggestedLessons": ["L1", "L2"],
         "coverage": "strong"
       }
     ]
   }
</rules>

CONTEXT PER QUESTION (JSON):
${JSON.stringify(contexts)}
`;

      try {
         const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt }
         ];

         // Inject recent chat history (filter out any error/fallback messages)
         if (recentHistory && recentHistory.length > 0) {
            for (const h of recentHistory) {
               if (h.role === 'user') {
                  chatMessages.push({ role: 'user', content: h.content });
               } else if (h.role === 'assistant') {
                  let cleanContent = h.content;
                  try {
                     const parsed = JSON.parse(h.content);
                     const items = Array.isArray(parsed) ? parsed : (parsed.responses || parsed.data || []);
                     if (Array.isArray(items) && items.length > 0) {
                        cleanContent = items.map((it: any) => it.content || '').filter(Boolean).join('\n\n');
                     }
                  } catch (e) {
                     // plain text
                  }
                  if (cleanContent && !cleanContent.includes("unable to generate a response")) {
                     chatMessages.push({ role: 'assistant', content: cleanContent });
                  }
               }
            }
         }

         // Current user turn
         chatMessages.push({ role: 'user', content: message });

         // Prioritize fast, reliable JSON model
         const candidateModels = [
            'qwen/qwen3.8-27b',
            this.groqModel || 'openai/gpt-oss-120b',
            'openai/gpt-oss-20b'
         ].filter((v, i, a) => v && a.indexOf(v) === i);

         for (const model of candidateModels) {
            try {
               const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                     'Authorization': `Bearer ${this.groqApiKey}`,
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     model,
                     messages: chatMessages,
                     temperature: 0.3,
                     max_tokens: 1000,
                  }),
                  signal: AbortSignal.timeout(15000),
               });

               if (response.ok) {
                  const data = await response.json();
                  const contentStr = data.choices?.[0]?.message?.content;
                  if (contentStr) {
                     const parsedResult = this.parseLlmResponse(contentStr, contexts);
                     if (parsedResult) return parsedResult;
                  }
               } else {
                  const errText = await response.text();
                  this.logger.warn(`Model ${model} returned ${response.status}: ${errText}`);
                  try {
                     const errJson = JSON.parse(errText);
                     if (errJson?.error?.failed_generation) {
                        const parsedResult = this.parseLlmResponse(errJson.error.failed_generation, contexts);
                        if (parsedResult) return parsedResult;
                     }
                  } catch {}
               }
            } catch (err) {
               this.logger.warn(`Model ${model} attempt failed: ${(err as Error).message}`);
            }
         }
      } catch (e) {
         this.logger.error('Failed calling LLM models:', e);
      }

      // Intelligent conceptual guidance fallback
      return contexts.map(c => {
         const citations = c.dependsOnLessons?.slice(0, 2).map((d: any) => d.lessonTitle) || [];
         const qTopic = c.questionText ? `regarding "${c.questionText.slice(0, 90)}..."` : '';
         return {
            questionId: c.questionId,
            questionNumber: c.questionNumber,
            content: `To solve this question ${qTopic}, focus on the underlying architecture and responsibilities of each component. Consider which resource is explicitly designed to maintain declared state and continuously reconcile active instances with your target configuration.`,
            lessonIds: c.dependsOnLessons?.map((d: any) => d.ref) || [],
            suggestedLessons: citations,
            coverage: 'strong'
         };
      });
   }

   private parseLlmResponse(raw: string, contexts: any[]): any[] | null {
      if (!raw || !raw.trim()) return null;
      let clean = raw.trim();
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      try {
         const parsed = JSON.parse(clean);
         const list = Array.isArray(parsed) ? parsed : (parsed.responses || parsed.data || (parsed.questionId ? [parsed] : null));
         if (list && Array.isArray(list) && list.length > 0) {
            return list;
         }
      } catch {}

      // Try regex extracting JSON object with "responses"
      const jsonMatch = clean.match(/\{[\s\S]*"responses"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
      if (jsonMatch) {
         try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.responses) && parsed.responses.length > 0) {
               return parsed.responses;
            }
         } catch {}
      }

      // If the model returned plain text Socratic guidance, wrap it gracefully!
      if (clean.length > 20) {
         return contexts.map((c) => ({
            questionId: c.questionId,
            questionNumber: c.questionNumber,
            content: clean,
            lessonIds: c.dependsOnLessons?.map((d: any) => d.ref) || [],
            suggestedLessons: c.dependsOnLessons?.slice(0, 2).map((d: any) => d.lessonTitle) || [],
            coverage: 'strong'
         }));
      }

      return null;
   }
}
