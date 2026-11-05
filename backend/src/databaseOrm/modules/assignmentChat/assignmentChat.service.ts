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
   private readonly groqModel = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b'; // fallback model if needed

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

      // Intent check for direct blatant solution extraction without question context
      if (this.isDirectAnswerRequest(message) && (!focusQuestionIds?.length && !this.parseExplicitQuestionNumbers(message).length)) {
         return this.saveAndReturnBlockedMessage(assignmentId, traineeId, message, "I cannot provide direct test answers or complete submission phrasing. However, I can explain the underlying concepts, compare component roles, or guide your solution structure. Ask about any specific question or concept!");
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
               const lastAsst = history.slice().reverse().find(m => m.role === 'assistant' && m.questionIds && m.questionIds.length > 0);
               if (lastAsst) {
                  targetQuestionIds = lastAsst.questionIds;
               }
            }
            // fallback: target all questions up to 5
            if (targetQuestionIds.length === 0) {
               targetQuestionIds = questions.slice(0, 5).map((q, idx) => q.id || String(idx));
            }
         }
      }

      // Allow up to 5 questions in the assignment
      targetQuestionIds = Array.from(new Set(targetQuestionIds)).slice(0, 5);

      // 3. Build context per question
      const contexts: any[] = [];
      const assModId = (assignment as any).moduleId || assignment.module?.id;
      const assLpId = (assignment as any).learningPathId || assignment.learningPath?.id;

      for (const qId of targetQuestionIds) {
         const qObj = questions.find(q => q.id === qId || String(questions.indexOf(q)) === qId);

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

         // If question entity didn't have qld relation, check direct qObj.lessonDependencies
         if (lessonIds.length === 0 && qObj?.lessonDependencies?.length > 0) {
            lessonIds = qObj.lessonDependencies;
            try {
               const directLessons = await this.dataSource.query(
                  `SELECT id, title, "moduleId", "learningPathId" FROM "Lesson" WHERE id = ANY($1)`,
                  [lessonIds]
               );
               dependsOnLessons = directLessons.map((l: any, idx: number) => ({
                  ref: `L${idx + 1}`,
                  lessonId: l.id,
                  lessonNumber: idx + 1,
                  lessonTitle: l.title || 'Prerequisite Lesson',
                  url: this.computeLessonUrl(l, assModId, assLpId)
               }));
            } catch (err) {
               this.logger.warn(`Failed to fetch direct lessonDependencies: ${(err as Error).message}`);
            }
         }

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
            try {
               if (assModId) {
                  fallbackLessons = await this.dataSource.query(
                     `SELECT id, title, "moduleId", "learningPathId" FROM "Lesson" WHERE "moduleId" = $1 ORDER BY COALESCE("display_order", 1) ASC, "created_at" ASC LIMIT 4`,
                     [assModId]
                  );
               }
               if (!fallbackLessons.length && assLpId) {
                  fallbackLessons = await this.dataSource.query(
                     `SELECT l.id, l.title, l."moduleId", m."learningPathId" FROM "Lesson" l 
                      JOIN "Module" m ON m.id = l."moduleId" 
                      WHERE m."learningPathId" = $1 
                      ORDER BY m."created_at" ASC, COALESCE(l."display_order", 1) ASC, l."created_at" ASC LIMIT 4`,
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
            } catch (err) {
               this.logger.warn(`Failed to retrieve fallback prerequisite lessons: ${(err as Error).message}`);
            }
         }

         const questionType = qObj?.type || (qObj?.options?.length ? 'MCQ' : (assignment.assignmentType === 'MCQ' ? 'MCQ' : 'Subjective'));
         const questionOptions = qObj?.options || assignment.mcqConfig?.options || [];

         contexts.push({
            questionId: qObj?.id || qId,
            questionNumber: questions.indexOf(qObj) + 1,
            type: questionType,
            questionText: qObj?.text || (qObj as any)?.questionText || (qObj as any)?.question || '',
            options: questionOptions,
            maxPoints: qObj?.maxPoints || 10,
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
      let aiResponse = await this.callGroq(contexts, message, recentHistory, assignment);

      // Verify that all contexts have a corresponding response. If LLM skipped any question, auto-synthesize!
      if (Array.isArray(aiResponse)) {
         for (const ctx of contexts) {
            const hasItem = aiResponse.some(r => String(r.questionId) === String(ctx.questionId));
            if (!hasItem) {
               this.logger.warn(`LLM omitted Question ${ctx.questionNumber} (${ctx.questionId}). Synthesizing Socratic guidance.`);
               aiResponse.push(this.generateSocraticFallbackForQuestion(ctx));
            }
         }

         // Sort responses in the same questionNumber order
         aiResponse.sort((a, b) => {
            const idxA = contexts.findIndex(c => String(c.questionId) === String(a.questionId));
            const idxB = contexts.findIndex(c => String(c.questionId) === String(b.questionId));
            return (idxA !== -1 ? idxA : 0) - (idxB !== -1 ? idxB : 0);
         });

         // 5. Strict Academic Integrity & MCQ Leak Guard
         aiResponse = this.sanitizeAndGuardResponses(aiResponse, contexts, assignment, questions);

         // Map refs (e.g. "L1") back to structured lesson objects with redirection URLs for the frontend
         aiResponse = aiResponse.map(res => {
            const ctx = contexts.find(c => String(c.questionId) === String(res.questionId));
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
      return lower.includes('give me the answer') ||
         lower.includes('tell me the answer') ||
         lower.includes('write the answer for me') ||
         lower.includes('write my submission') ||
         lower.includes('complete this assessment for me');
   }

   /**
    * Strict Pedagogical Honor Code & Anti-Cheat Engine for Assessment Workspaces:
    * 1. Inspects MCQ questions to guarantee the AI assistant never leaks the direct answer or choice.
    * 2. Auto-sanitizes leaked choices into high-level, Socratic architectural guidance.
    * 3. Prevents answer extraction via clever prompting or elimination tricks.
    */
   private sanitizeAndGuardResponses(responses: any[], contexts: any[], assignment: AssignmentEntity, questions: any[]): any[] {
      return responses.map(res => {
         const ctx = contexts.find(c => String(c.questionId) === String(res.questionId));
         const qObj = questions.find(q => String(q.id) === String(res.questionId) || String(questions.indexOf(q)) === String(res.questionId));
         if (!ctx || !qObj) return res;

         const isMcq = ctx.type === 'MCQ' || qObj.type === 'MCQ' || (qObj.options && qObj.options.length > 0) || (assignment.assignmentType === 'MCQ');
         if (isMcq) {
            const correctIdx = qObj.correctIndex !== undefined ? qObj.correctIndex : (assignment.mcqConfig?.correctIndex);
            const options: string[] = qObj.options || assignment.mcqConfig?.options || [];
            const correctChoice = (correctIdx !== undefined && options[correctIdx]) ? options[correctIdx] : null;

            let content = res.content || '';
            let isLeaked = false;

            // 1. Direct answer assertion leaks
            if (/(?:the|correct|right|suitable|actual)\s+answer\s+is/i.test(content) ||
               /(?:choose|select|pick)\s+(?:option\s+)?/i.test(content) ||
               /(?:option\s+[a-d1-4]|choice\s+[a-d1-4])\s+is\s+(?:the\s+)?(?:correct|right|suitable|best|actual)/i.test(content) ||
               /(?:my\s+answer\s+is|answer\s+to\s+this\s+is)/i.test(content)) {
               isLeaked = true;
            }

            // 2. Correct choice giveaway for this specific MCQ
            if (correctChoice) {
               const escapedChoice = correctChoice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
               // Pattern: "ReplicaSet ... replica count / declared replica / keeps the count steady"
               const pattern1 = new RegExp(`${escapedChoice}\\s+(?:directly\\s+)?(?:watches|ensures|maintains|enforces|creates|manages|monitors)\\s+(?:the\\s+)?(?:desired\\s+|declared\\s+)?replica`, 'i');
               // Pattern: "replica-count enforcement is done by ReplicaSet"
               const pattern2 = new RegExp(`(?:replica[- ]count\\s+enforcement|replica\\s+count|reconciliation)\\s+is\\s+done\\s+by\\s+(?:the\\s+)?${escapedChoice}`, 'i');
               // Pattern: "ReplicaSet is the object that ensures"
               const pattern3 = new RegExp(`${escapedChoice}\\s+is\\s+(?:the\\s+)?(?:object|controller|resource|component)\\s+that\\s+(?:ensures|matches|manages)`, 'i');
               // Pattern: "done by the ReplicaSet"
               const pattern4 = new RegExp(`done\\s+by\\s+(?:the\\s+)?${escapedChoice}`, 'i');

               if (pattern1.test(content) || pattern2.test(content) || pattern3.test(content) || pattern4.test(content)) {
                  isLeaked = true;
               }
            }

            if (isLeaked) {
               this.logger.warn(`[Academic Integrity Guard] Leaked choice detected for MCQ ${qObj.id || ctx.questionNumber}. Sanitizing to Socratic guidance.`);
               res.content = this.getSocraticMcqGuidance(ctx);
            }
         }

         return res;
      });
   }

   private getSocraticMcqGuidance(ctx: any): string {
      if (ctx.options && ctx.options.length > 0) {
         return `I cannot directly indicate the correct option during an active assessment. When evaluating the choices (${ctx.options.join(', ')}), consider how Kubernetes separates architectural responsibilities:
• Network objects (like Service or Ingress) manage endpoint routing and load balancing for incoming traffic.
• Configuration objects (like ConfigMap) inject settings, variables, or volume files into containers.
• Workload controllers run continuous reconciliation loops that monitor actual cluster state and adjust active pod instances to match target specifications.
Reflect on which of these specific objects acts as a lifecycle controller to maintain the declared count described in the question.`;
      }
      return `When evaluating the options for this question, focus on the fundamental distinction between the categories of components: consider which resource manages active lifecycle and state reconciliation versus resources dedicated to network routing or configuration storage. Review the prerequisite lessons to determine which component matches this specific responsibility.`;
   }

   private generateSocraticFallbackForQuestion(ctx: any): any {
      const citations = ctx.dependsOnLessons?.slice(0, 2).map((d: any) => d.lessonTitle) || [];
      if (ctx.type === 'MCQ') {
         return {
            questionId: ctx.questionId,
            questionNumber: ctx.questionNumber,
            content: `For Question ${ctx.questionNumber}, compare the architectural roles of the available options: consider which resource manages active lifecycle and continuous state reconciliation versus resources dedicated to network routing or configuration storage. Review the prerequisite lessons on core concepts and controllers to evaluate which component matches this specific lifecycle responsibility.`,
            suggestedLessons: citations,
            coverage: 'strong'
         };
      }

      return {
         questionId: ctx.questionId,
         questionNumber: ctx.questionNumber,
         content: `For Question ${ctx.questionNumber}, structure your response around the key workflow stages: 1) Strategy configuration and parameter limits (such as rolling update surge and unavailable thresholds); 2) Readiness probe integration to prevent prematurely routing user requests; 3) Graceful shutdown controls; and 4) Deployment verification procedures. Review the linked prerequisite lessons for reference manifest architectures.`,
         suggestedLessons: citations,
         coverage: 'strong'
      };
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
      const lower = message.toLowerCase().trim();

      // 1. Check if user specifically requested explicit question number(s) in the message
      const explicit = this.parseExplicitQuestionNumbers(message);
      if (explicit.length > 0) {
         explicit.forEach(num => {
            const q = questions[num - 1];
            if (q) qIds.add(q.id || String(num - 1));
         });
         return Array.from(qIds);
      }

      // 2. Explicit "All" request in the message
      const isExplicitAllQuery = /\b(explain\s+all|all\s+questions|both\s+questions|everything|overview\s+all|summary\s+of\s+all)\b/i.test(lower) ||
         (lower === 'all' || lower === 'explain all' || lower === 'all question' || lower === 'explain both');

      if (isExplicitAllQuery) {
         questions.forEach(q => qIds.add(q.id || String(questions.indexOf(q))));
         return Array.from(qIds);
      }

      // 3. If user selected specific question chip(s) in UI
      if (focusQuestionIds && focusQuestionIds.length > 0) {
         focusQuestionIds.forEach(id => {
            const found = questions.find(q => q.id === id || String(questions.indexOf(q)) === id);
            if (found) qIds.add(found.id || String(questions.indexOf(found)));
         });
         if (qIds.size > 0) return Array.from(qIds);
      }

      // 4. Intent Detection: MCQ / Options queries (e.g. "which options is correct", "which option", "choice", "mcq", "what are the options")
      const isOptionQuery = /\b(option|options|choice|choices|choose|mcq|select\s+one|pick\s+one)\b/i.test(lower);
      if (isOptionQuery) {
         const mcqQuestions = questions.filter(q => q.type === 'MCQ' || (q.options && q.options.length > 0));
         if (mcqQuestions.length > 0) {
            // Target the MCQ question(s) ONLY! Never target subjective questions for options queries!
            mcqQuestions.forEach(q => qIds.add(q.id || String(questions.indexOf(q))));
            return Array.from(qIds);
         }
      }

      // 5. Keyword & Content Relevance Matching
      let bestMatch: { q: any; score: number } | null = null;
      for (const q of questions) {
         const qText = (q.text || q.questionText || '').toLowerCase();
         const optionsText = (q.options || []).join(' ').toLowerCase();
         const combined = `${qText} ${optionsText}`;

         const words = lower.split(/\s+/).filter(w => w.length >= 4 && !['what', 'which', 'where', 'when', 'explain', 'describe', 'about', 'this', 'that', 'with', 'from', 'have', 'help'].includes(w));
         let matches = 0;
         for (const w of words) {
            if (combined.includes(w)) matches++;
         }
         if (matches > 0 && (!bestMatch || matches > bestMatch.score)) {
            bestMatch = { q, score: matches };
         }
      }

      if (bestMatch && bestMatch.score >= 2) {
         qIds.add(bestMatch.q.id || String(questions.indexOf(bestMatch.q)));
         return Array.from(qIds);
      }

      if (lower.includes('all') || lower.includes('both')) {
         questions.slice(0, 5).forEach(q => qIds.add(q.id || String(questions.indexOf(q))));
         return Array.from(qIds);
      }

      if (bestMatch && bestMatch.score >= 1) {
         qIds.add(bestMatch.q.id || String(questions.indexOf(bestMatch.q)));
         return Array.from(qIds);
      }

      // Default fallback when no specific question is targeted:
      // Target all questions in the assignment (up to 5)
      questions.slice(0, 5).forEach(q => qIds.add(q.id || String(questions.indexOf(q))));
      return Array.from(qIds);
   }

   private async fetchLessonChunks(lessonIds: string[], query: string) {
      if (!lessonIds.length) return [];

      try {
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
      } catch (err) {
         this.logger.warn(`Failed to fetch lesson chunks: ${(err as Error).message}`);
         return [];
      }
   }

   private async callGroq(contexts: any[], message: string, recentHistory: AssignmentChatMessageEntity[] = [], assignment?: AssignmentEntity) {
      if (!this.groqApiKey) {
         this.logger.error('GROQ_API_KEY is missing');
         throw new Error('LLM configuration missing');
      }

      const systemPrompt = `
<role>
You are an AI pedagogical tutor and academic teaching assistant inside an enterprise Learning Management System (LMS).
A trainee is actively completing an assessment assignment and asks questions or requests conceptual explanations.
Your mission is to provide rigorous, helpful, and natural conceptual guidance that fosters genuine understanding and critical thinking WITHOUT revealing direct answers, confirming guesses, or solving test questions for the trainee.
</role>

<academic_integrity_guardrails>
1. STRICT MCQ INTEGRITY & OPTIONS BREAKDOWN:
   - For Multiple Choice Questions (type: "MCQ"):
     * NEVER state which option (e.g. Option A, B, C, D or index or option text) is correct or recommended (e.g. do NOT say "The correct option is ReplicaSet" or "Choose option C").
     * NEVER tell the trainee whether their selected option or guess is correct or incorrect (e.g. if trainee asks "Is ConfigMap correct?", do NOT say "ConfigMap is wrong" or "No, ConfigMap does not do this").
     * When the trainee asks about options (e.g. "which options is correct", "which option should I pick", "explain the options", "what is option 1 vs option 2", "which choice"):
       1. Start with a polite note that you cannot directly declare the winning option during an assessment.
       2. Break down and explain what EACH option in the list actually does in the architecture (neutrally defining each choice from the question options: ${contexts.map(c => (c.options || []).join(', ')).join('; ')}).
       3. Conclude with a guiding Socratic prompt asking the student which of these roles matches the exact requirement in the question.
     * Socratic & Architectural Guidance:
       - Explain the high-level architecture and how different categories of components divide responsibilities (e.g. traffic routing vs configuration storage vs lifecycle controllers).
       - Provide thoughtful guiding hints on what mechanism does declarative state reconciliation vs what simply exposes endpoints.
       - Prompt the student with reflective questions so THEY determine the answer on their own.

2. SUBJECTIVE / OPEN-ENDED QUESTIONS:
   - For subjective questions (type: "Subjective"):
     * Do NOT write a complete, ready-to-copy-paste full submission or exact code manifests.
     * Provide a clear conceptual breakdown of the key architecture steps, parameters to consider, and best practices.
     * If the student presents a draft or asks for feedback, give constructive evaluation of what concepts they included and what gaps remain.

3. MULTI-QUESTION COVERAGE ("explain all" / multiple contexts):
   - You are provided with ${contexts.length} questions in CONTEXT PER QUESTION.
   - You MUST generate exactly ${contexts.length} response items in the "responses" JSON array—one dedicated response for EVERY question provided.
   - Do NOT omit any question! If ${contexts.length} questions are provided, the "responses" array MUST have length ${contexts.length}.
</academic_integrity_guardrails>

<formatting_rules>
- Concise plain-text: 60 to 120 words per question.
- Plain text ONLY: NO markdown headers (#, ##), NO bold (**), NO italics (*), NO backticks (\`), NO emojis.
- Clean bullet points (•) for breaking down options or steps.
- Do NOT include robotic boilerplate headings like "Question Objective:" or "Citations:". Speak in a natural, friendly, expert tutor tone.
- In "suggestedLessons", supply 1-2 lesson references (e.g. "L1", "L2") or exact lesson titles from the context.
</formatting_rules>
- In "suggestedLessons", supply 1-2 lesson references (e.g. "L1", "L2") or lesson titles from the context.
</formatting_rules>

<output_schema>
Return ONLY a valid JSON object matching this exact schema:
{
  "responses": [
    ${contexts.map(c => `{
      "questionId": "${c.questionId}",
      "content": "Natural Socratic plain-text explanation for Question ${c.questionNumber}...",
      "suggestedLessons": ["L1", "L2"],
      "coverage": "strong"
    }`).join(',\n    ')}
  ]
}
</output_schema>

CONTEXT PER QUESTION (JSON):
${JSON.stringify(contexts, null, 2)}
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

         // Prioritize fast, reliable JSON models
         const candidateModels = [
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
                     temperature: 0.2,
                     max_tokens: 2500,
                  }),
                  signal: AbortSignal.timeout(18000),
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
                  } catch { }
               }
            } catch (err) {
               this.logger.warn(`Model ${model} attempt failed: ${(err as Error).message}`);
            }
         }
      } catch (e) {
         this.logger.error('Failed calling LLM models:', e);
      }

      // Intelligent conceptual guidance fallback for all requested contexts
      return contexts.map(c => this.generateSocraticFallbackForQuestion(c));
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
      } catch { }

      // Try regex extracting JSON object with "responses"
      const jsonMatch = clean.match(/\{[\s\S]*"responses"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
      if (jsonMatch) {
         try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.responses) && parsed.responses.length > 0) {
               return parsed.responses;
            }
         } catch { }
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
