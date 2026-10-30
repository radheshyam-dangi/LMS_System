import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, Repository, In } from 'typeorm';
import { EvaluationJobEntity } from '../../entities/evaluationJob.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { LessonContentCacheEntity } from '../../entities/lessonContentCache.entity';
import { NotificationService } from '../notification/notification.service';
import { Bm25Service } from './bm25.service';
import { EvaluationContextBuilderService, EvaluationContext } from './evaluationContext.service';


@Injectable()
export class EvaluationWorkerService {
  private readonly logger = new Logger(EvaluationWorkerService.name);
  private jobRepo: Repository<EvaluationJobEntity>;
  private submissionRepo: Repository<AssignmentSubmissionEntity>;
  private assignmentRepo: Repository<AssignmentEntity>;
  private cacheRepo: Repository<LessonContentCacheEntity>;

  private readonly MODEL = process.env.GROQ_EVAL_MODEL || 'openai/gpt-oss-120b';
  private readonly API_KEY = process.env.GROQ_API_KEY;
  private readonly MAX_CONTEXT_TOKENS = process.env.GROQ_MAX_CONTEXT_TOKENS ? parseInt(process.env.GROQ_MAX_CONTEXT_TOKENS, 10) : 4000;
  private isProcessing = false;

  constructor(
    private readonly datasource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly bm25Service: Bm25Service,
    private readonly contextBuilder: EvaluationContextBuilderService,
  ) {
    this.jobRepo = this.datasource.getRepository(EvaluationJobEntity);
    this.submissionRepo = this.datasource.getRepository(AssignmentSubmissionEntity);
    this.assignmentRepo = this.datasource.getRepository(AssignmentEntity);
    this.cacheRepo = this.datasource.getRepository(LessonContentCacheEntity);
  }

  // Poll every 10 seconds
  @Cron('*/10 * * * * *')
  async pollEvaluationJobs() {
    if (this.isProcessing) return; // Prevent concurrent polling overlaps
    this.isProcessing = true;

    try {
       const pendingJobs = await this.jobRepo.createQueryBuilder('job')
        .leftJoinAndSelect('job.submission', 'submission')
        .leftJoinAndSelect('submission.assignment', 'assignment')
        .leftJoinAndSelect('assignment.createdBy', 'createdBy')
        .leftJoinAndSelect('submission.trainee', 'trainee')
        .leftJoinAndSelect('submission.evaluatedBy', 'evaluatedBy')
        .where('job.status IN (:...statuses)', { statuses: ['pending', 'failed'] })
        .andWhere('job.attempts < job.maxAttempts')
        .orderBy('job.createdAt', 'ASC')
        .take(5)
        .getMany();

      for (const job of pendingJobs) {
        await this.processSubmission(job.id, job.submission?.id || (job as any).submissionId);
      }
    } catch (e) {
      this.logger.error('Error polling evaluation jobs:', e);
    } finally {
      this.isProcessing = false;
    }
  }

  
  async processSubmission(jobId: string, submissionId: string) {
    if (!submissionId) return;

    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;

    job.status = 'processing';
    job.startedAt = new Date();
    job.attempts += 1;
    await this.jobRepo.save(job);

    if (job.attempts > job.maxAttempts) {
      this.logger.error(`Max attempts reached for submission ${submissionId}`);
      await this.fallbackToManualReview(submissionId, jobId, 'Maximum retry attempts exceeded');
      return;
    }

    try {
      const submission = await this.submissionRepo.findOne({
        where: { id: submissionId },
        relations: [
          'assignment',
          'trainee',
          'assignment.lesson',
          'assignment.lesson.module',
          'assignment.lesson.module.learningPath',
          'assignment.module',
          'assignment.module.learningPath',
          'assignment.learningPath',
          'assignment.createdBy',
          'evaluatedBy'
        ],
      });
      if (!submission) throw new Error('Submission not found');

      const assignment = submission.assignment;
      if (!assignment) throw new Error('Assignment not found');

      let learningPathId = assignment.learningPath?.id || assignment.module?.learningPath?.id || assignment.lesson?.module?.learningPath?.id;
      let trainerId: string | undefined;

      if (learningPathId && submission.trainee?.id) {
        const enrollmentRepo = this.datasource.getRepository('Enrollment');
        const enrollment: any = await enrollmentRepo.findOne({
          where: { user: { id: submission.trainee.id }, learningPath: { id: learningPathId } },
          relations: ['assignedBy']
        });
        if (enrollment?.assignedBy?.id) {
          trainerId = enrollment.assignedBy.id;
        }
      }

      const recipientId = trainerId || assignment.createdBy?.id || (assignment as any).assignedBy?.id || (assignment as any).createdById;
      if (!recipientId) {
        job.status = 'failed';
        job.lastError = 'Missing recipient';
        await this.jobRepo.save(job);
        return;
      }

      (assignment as any).dynamicRecipientId = recipientId;

      const questions = this.normalizeQuestions(assignment);
      const submittedAnswers = this.extractSubmittedAnswers(submission, questions);

      const rubricCache = new Map();
      const evaluationPromises = questions.map((q, idx) => {
        const ans = this.findAnswerForQuestion(submittedAnswers, q, idx, questions.length);
        return this.evaluateQuestion(q, ans, assignment, rubricCache);
      });

      const results = await Promise.allSettled(evaluationPromises);
      const questionScores: any[] = [];
      let aiEvaluationError = false;

      results.forEach((result, i) => {
        const q = questions[i];
        if (result.status === 'rejected') {
          this.logger.error(`Question ${q.id} failed:`, result.reason);
          questionScores.push({
            questionId: q.id,
            score: 0,
            maxScore: q.maxPoints,
            remark: `Evaluation failed: ${result.reason.message}`,
            type: q.type || 'subjective',
            needsManualReview: true,
            confidence: 0,
            groundingSource: 'error'
          });
          aiEvaluationError = true;
        } else {
          questionScores.push(result.value);
        }
      });

      await this.routeResults(submission, assignment, questionScores, aiEvaluationError);

      job.status = 'completed';
      job.completedAt = new Date();
      await this.jobRepo.save(job);
    } catch (err: any) {
      this.logger.error(`Evaluation failed for submission ${submissionId}:`, err);
      job.status = 'failed';
      job.lastError = err.message;
      await this.jobRepo.save(job);
      if (job.attempts >= job.maxAttempts - 1) {
        await this.fallbackToManualReview(submissionId, jobId, err.message);
      }
    }
  }

  private resolveOptionIndex(val: any, options: string[] = []): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') {
      if (!isNaN(val) && val >= 0 && (options.length === 0 || val < options.length)) return val;
    }

    const str = String(val).trim();
    if (!str) return null;

    const num = Number(str);
    if (!isNaN(num) && num >= 0 && (options.length === 0 || num < options.length)) {
      return num;
    }

    if (options && options.length > 0) {
      const cleanStr = str.toLowerCase().replace(/^[a-d][\.\)]\s*/i, '').trim();
      for (let i = 0; i < options.length; i++) {
        const opt = String(options[i]).trim();
        const cleanOpt = opt.toLowerCase().replace(/^[a-d][\.\)]\s*/i, '').trim();
        if (opt.toLowerCase() === str.toLowerCase() || cleanOpt === cleanStr) {
          return i;
        }
      }
      for (let i = 0; i < options.length; i++) {
        const cleanOpt = String(options[i]).toLowerCase().replace(/^[a-d][\.\)]\s*/i, '').trim();
        if (cleanOpt.length > 2 && (cleanOpt.includes(cleanStr) || cleanStr.includes(cleanOpt))) {
          return i;
        }
      }
    }

    const letterMatch = str.match(/^(?:option\s+)?([A-D])(?:\.|\)|:|$|\s)/i);
    if (letterMatch) {
      const letterIdx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
      if (letterIdx >= 0 && (options.length === 0 || letterIdx < options.length)) {
        return letterIdx;
      }
    }

    return null;
  }

  private extractSubmittedAnswers(submission: AssignmentSubmissionEntity, questions: any[]): Array<{ questionId?: string; index?: number; answer: string }> {
    const results: Array<{ questionId?: string; index?: number; answer: string }> = [];

    // Helper to merge or insert an answer
    const mergeAnswer = (qId: string | undefined, idx: number | undefined, ans: any) => {
      if (ans === undefined || ans === null) return;
      const strVal = String(ans).trim();
      if (!strVal) return;

      const existing = results.find(r => 
        (qId && r.questionId === qId) || 
        (idx !== undefined && r.index === idx)
      );

      if (existing) {
        if (!existing.answer || existing.answer.trim() === '') {
          existing.answer = strVal;
        }
      } else {
        results.push({ questionId: qId, index: idx, answer: strVal });
      }
    };

    // 1. Direct submission.answers array
    if (Array.isArray(submission.answers) && submission.answers.length > 0) {
      submission.answers.forEach((item, i) => {
        if (item && typeof item === 'object') {
          const qId = item.questionId ? String(item.questionId) : undefined;
          const ans = item.answer ?? (item as any).value ?? (item as any).selectedOption;
          results.push({
            questionId: qId,
            index: i,
            answer: String(ans ?? '').trim(),
          });
        } else if (item != null) {
          results.push({
            index: i,
            answer: String(item).trim(),
          });
        }
      });
    }

    // 2. Direct mcqAnswers field if attached
    const directMcq = (submission as any).mcqAnswers || (submission as any).mcq_answers;
    if (directMcq && typeof directMcq === 'object') {
      for (const [key, val] of Object.entries(directMcq)) {
        const idx = parseInt(key, 10);
        mergeAnswer(isNaN(idx) ? key : undefined, !isNaN(idx) ? idx : undefined, val);
      }
    }

    // 3. Parse submission.submissionText
    if (submission.submissionText) {
      try {
        const parsed = typeof submission.submissionText === 'string'
          ? JSON.parse(submission.submissionText)
          : submission.submissionText;

        if (Array.isArray(parsed)) {
          for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            if (typeof item === 'string') {
              mergeAnswer(undefined, i, item);
            } else if (item && typeof item === 'object') {
              const qId = item.questionId ? String(item.questionId) : undefined;
              const ans = item.answer ?? item.value ?? item.selectedOption;
              mergeAnswer(qId, i, ans);
            }
          }
        } else if (parsed && typeof parsed === 'object') {
          // Check mcqAnswers / mcq
          const pMcq = parsed.mcqAnswers || parsed.mcq;
          if (pMcq && typeof pMcq === 'object') {
            for (const [key, val] of Object.entries(pMcq)) {
              const idx = parseInt(key, 10);
              mergeAnswer(isNaN(idx) ? key : undefined, !isNaN(idx) ? idx : undefined, val);
            }
          }

          // Check textAnswers / subj
          const pSubj = parsed.textAnswers || parsed.subj;
          if (pSubj && typeof pSubj === 'object') {
            for (const [key, val] of Object.entries(pSubj)) {
              const idx = parseInt(key, 10);
              mergeAnswer(isNaN(idx) ? key : undefined, !isNaN(idx) ? idx : undefined, val);
            }
          }

          // Check answers array or object
          if (Array.isArray(parsed.answers)) {
            parsed.answers.forEach((item: any, i: number) => {
              if (item && typeof item === 'object') {
                const qId = item.questionId ? String(item.questionId) : undefined;
                const ans = item.answer ?? item.value ?? item.selectedOption;
                mergeAnswer(qId, i, ans);
              }
            });
          } else if (parsed.answers && typeof parsed.answers === 'object') {
            for (const [key, val] of Object.entries(parsed.answers)) {
              const idx = parseInt(key, 10);
              mergeAnswer(isNaN(idx) ? key : undefined, !isNaN(idx) ? idx : undefined, val);
            }
          }

          // Fallback to raw
          if (results.length === 0 && parsed.raw && typeof parsed.raw === 'string' && parsed.raw.trim().length > 0) {
            results.push({ answer: parsed.raw.trim() });
          }
        }
      } catch {
        // Not JSON — plain text submission
        if (results.length === 0) {
          results.push({ answer: String(submission.submissionText).trim() });
        }
      }
    }

    return results;
  }

  private normalizeQuestions(assignment: AssignmentEntity): any[] {
    if (!assignment) return [];
    let rawList: any[] = [];

    if (Array.isArray(assignment.questions) && assignment.questions.length > 0) {
      rawList = assignment.questions;
    } else if (Array.isArray((assignment.mcqConfig as any)?.questions) && (assignment.mcqConfig as any).questions.length > 0) {
      rawList = (assignment.mcqConfig as any).questions;
    } else if (typeof assignment.questions === 'string') {
      try {
        const p = JSON.parse(assignment.questions);
        if (Array.isArray(p) && p.length > 0) rawList = p;
        else if (Array.isArray(p?.questions) && p.questions.length > 0) rawList = p.questions;
      } catch {}
    } else if (typeof assignment.mcqConfig === 'string') {
      try {
        const p = JSON.parse(assignment.mcqConfig);
        if (Array.isArray(p?.questions) && p.questions.length > 0) rawList = p.questions;
        else if (Array.isArray(p?.options) && p.options.length > 0) {
          rawList = [{
            id: '0',
            text: assignment.title || assignment.description || 'Question 1',
            options: p.options,
            correctIndex: p.correctIndex ?? 0,
            maxPoints: assignment.maxScore || 10,
            type: 'MCQ',
          }];
        }
      } catch {}
    } else if (assignment.mcqConfig && Array.isArray(assignment.mcqConfig.options) && assignment.mcqConfig.options.length > 0) {
      rawList = [{
        id: '0',
        text: assignment.title || assignment.description || 'Question 1',
        options: assignment.mcqConfig.options,
        correctIndex: assignment.mcqConfig.correctIndex ?? 0,
        maxPoints: assignment.maxScore || 10,
        type: 'MCQ',
      }];
    }

    return rawList.map((q, idx) => ({
      ...q,
      id: String(q.id ?? idx),
      text: q.questionText || q.text || q.question || q.title || `Question ${idx + 1}`,
      maxPoints: Number(q.maxPoints ?? q.points ?? (assignment.maxScore && rawList.length === 1 ? assignment.maxScore : 10)),
      type: q.type || (Array.isArray(q.options) && q.options.length > 0 ? 'MCQ' : 'Subjective'),
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: q.correctIndex != null ? Number(q.correctIndex) : null,
      expectedAnswerGuideline: q.expectedAnswerGuideline || q.guidelines || '',
    }));
  }

  private findAnswerForQuestion(
    submittedAnswers: Array<{ questionId?: string; index?: number; answer: string }>,
    question: any,
    questionIndex: number,
    totalQuestions: number,
  ): { answer: string } | undefined {
    // 1. Match by questionId
    if (question.id !== undefined && question.id !== null) {
      const match = submittedAnswers.find(a => a.questionId && String(a.questionId) === String(question.id));
      if (match) return match;
    }

    // 2. Match by question index
    const matchByIndex = submittedAnswers.find(a => a.index !== undefined && a.index === questionIndex);
    if (matchByIndex) return matchByIndex;

    // 3. Fallback: ONLY when the entire assignment consists of exactly one question
    if (totalQuestions === 1 && submittedAnswers.length === 1 && submittedAnswers[0].answer) {
      return submittedAnswers[0];
    }

    return undefined;
  }

  private async evaluateQuestion(question: any, answer: any, assignment: AssignmentEntity, rubricCache: Map<string, any>) {
    const isMcq = String(question.type || '').toLowerCase() === 'mcq'
      || String(question.type || '').toLowerCase() === 'multiple choice'
      || (Array.isArray(question.options) && question.options.length > 0);

    const maxPoints = Number(question.maxPoints ?? question.points ?? 10);

    if (isMcq) {
      const correctIndex = question.correctIndex != null && !isNaN(Number(question.correctIndex)) ? Number(question.correctIndex) : null;
      const expectedOption = (correctIndex !== null && question.options?.[correctIndex])
        ? String(question.options[correctIndex]).trim()
        : '';
      const ansVal = String(answer?.answer ?? answer?.selectedOption ?? '').trim();
      const resolvedChoiceIdx = this.resolveOptionIndex(ansVal, question.options);

      // If trainee did not answer or left empty
      if (resolvedChoiceIdx === null && !ansVal) {
        return {
          questionId: question.id,
          score: 0,
          maxScore: maxPoints,
          remark: 'No option was selected by the trainee.',
          type: 'mcq',
          confidence: 1.0,
          groundingSource: 'deterministic',
          needsManualReview: false,
        };
      }

      let isCorrect = false;
      if (resolvedChoiceIdx !== null && correctIndex !== null && resolvedChoiceIdx === correctIndex) {
        isCorrect = true;
      } else if (expectedOption && ansVal.toLowerCase() === expectedOption.toLowerCase()) {
        isCorrect = true;
      }

      return {
        questionId: question.id,
        score: isCorrect ? maxPoints : 0,
        maxScore: maxPoints,
        remark: isCorrect
          ? 'Correct option selected by the trainee.'
          : 'Incorrect option selected by the trainee.',
        type: 'mcq',
        confidence: 1.0,
        groundingSource: 'deterministic',
        needsManualReview: false,
      };
    }

    // ─── SUBJECTIVE EVALUATION ───
    const answerText = String(answer?.answer || '').trim();
    if (!answerText || answerText.length < 5) {
      return {
        questionId: question.id,
        score: 0,
        maxScore: maxPoints,
        remark: 'No meaningful answer provided by the trainee.',
        type: 'subjective',
        confidence: 1.0,
        groundingSource: 'no_answer',
        needsManualReview: false,
      };
    }

    const context = await this.contextBuilder.buildContextForQuestion(
      question.id,
      answerText,
      question.text,
      rubricCache
    );

    const parsedResult = await this.callGroqForQuestion(question, answerText, context, assignment);

    return {
      questionId: question.id,
      score: parsedResult.score,
      maxScore: maxPoints,
      remark: parsedResult.feedback,
      type: 'subjective',
      confidence: parsedResult.confidence,
      groundingSource: context.groundingSourcePlan === 'module_fallback' ? 'module_fallback' : (parsedResult.groundingSource === 'rubric' ? 'lesson_context' : parsedResult.groundingSource),
      needsManualReview: parsedResult.confidence < 0.75,
      contentVersionsUsed: context.contentVersionsUsed,
    };
  }

  private async callGroqForQuestion(question: any, answerText: string, context: EvaluationContext, assignment: AssignmentEntity) {
    if (!this.MODEL || !this.API_KEY) throw new Error('GROQ config missing');

    const maxPoints = Number(question.maxPoints ?? question.points ?? 10);
    const systemPrompt = `You are an experienced, fair senior technical trainer grading a trainee's subjective assignment answer.
Evaluate the trainee's answer objectively based on meaning, conceptual understanding, relevance, and fulfillment of question requirements.

GRADING CRITERIA & SCORE ALLOCATION:
1. RELEVANCE & CONCEPTUAL UNDERSTANDING (Scale: 0 to ${maxPoints}):
   - ZERO MARKS (0/${maxPoints}): Award 0 ONLY if the answer is completely blank, gibberish/nonsense, spam, or 100% off-topic (e.g. discussing cooking recipes, unrelated trivia, or making zero attempt to address the question prompt).
   - PARTIAL / FEW MARKS (1 to ${Math.max(1, Math.round(maxPoints * 0.45))}/${maxPoints}): If the answer is SOMEHOW RELEVANT to the question requirement (e.g. attempts to address the topic, mentions relevant Kubernetes components, basic concepts, partial steps, or general principles, even if incomplete, brief, or missing specific manifest parameters). Award partial credit proportional to what was correctly identified.
   - SUBSTANTIAL MARKS (${Math.round(maxPoints * 0.5)} to ${Math.round(maxPoints * 0.85)}/${maxPoints}): If the answer is largely accurate and addresses the core requirements, with only minor gaps, slight inaccuracies, or missing secondary configuration options.
   - FULL / NEAR-FULL MARKS (${Math.round(maxPoints * 0.9)} to ${maxPoints}/${maxPoints}): If the answer is accurate, well-structured, covers all key steps/concepts, and fully satisfies the question requirements.

2. EFFECTIVE & ACCURATE ONE-SENTENCE FEEDBACK (STRICT CONSTRAINT):
   - Provide EXACTLY ONE grammatically complete, highly effective sentence evaluating the trainee's answer.
   - The feedback must accurately reflect the trainee's actual submitted answer: explicitly mention what technical concepts they correctly addressed and what key details or configuration parameters were missing or inaccurate.
   - Length: Strictly 1 concise sentence (maximum 20 words).
   - Tone: Direct, professional technical trainer feedback. Never use conversational filler, pleasantries, greetings, or meta-introductions (e.g. do NOT say "The student explains...", "Good answer", "In summary...").
   - Formatting: Output clean plain text only. Do NOT use markdown asterisks (*, **), quotes, or backticks (\`).

Return ONLY valid JSON matching this exact shape:
{
  "score": <number between 0 and ${maxPoints}>,
  "feedback": "<string: strictly 1 concise, accurate sentence>",
  "confidence": <number between 0.0 and 1.0>,
  "groundingSource": "lesson_context" | "rubric" | "retrieved_passage" | "unsupported" | "no_lesson_dependency"
}`;

    const contextSections: string[] = [];
    if (question.expectedAnswerGuideline) {
      contextSections.push(`--- Expected Rubric / Guideline ---\n${question.expectedAnswerGuideline}`);
    }

    const lessonKeyPointsStr = context.rubrics.map(r => `[Lesson: ${r.lessonName}]\n${r.keyPoints.map((kp: any) => `- ${kp.point}`).join('\n')}`).join('\n\n').substring(0, 4000);
    const chunksStr = context.retrievedChunks.map(c => `[From ${c.lessonName}]: "${c.chunkText}"`).join('\n\n').substring(0, 8000);
    const safeAnswerText = answerText.substring(0, 5000);

    if (lessonKeyPointsStr) {
      contextSections.push(`--- Dependent Lesson Key Concepts ---\n${lessonKeyPointsStr}`);
    }
    if (chunksStr) {
      contextSections.push(`--- Dependent Lesson Source Passages ---\n${chunksStr}`);
    }
    const combinedContext = contextSections.length > 0
      ? contextSections.join('\n\n')
      : '--- Dependent Lesson Context ---\n[No lesson dependency context provided]';

    const userPrompt = `QUESTION: ${question.text}\n\nTRAINEE'S ANSWER: ${safeAnswerText}\n\n${combinedContext}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.API_KEY}` },
      body: JSON.stringify({
        model: this.MODEL,
        messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt } ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Groq API error ${response.status}: ${errText}`);
      throw new Error(`Groq API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      const cleaned = rawContent.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            throw new Error(`Unparseable JSON from model: ${rawContent.substring(0, 200)}`);
          }
        } else {
          throw new Error(`Unparseable JSON from model: ${rawContent.substring(0, 200)}`);
        }
      }
    }
    
    // clamp score strictly between 0 and maxPoints
    parsed.score = Math.min(Math.max(Number(parsed.score) || 0, 0), maxPoints);

    // Sanitize feedback to guarantee strictly ONE clean sentence
    if (parsed.feedback && typeof parsed.feedback === 'string') {
      let clean = parsed.feedback.replace(/[`*"]/g, '').replace(/\s+/g, ' ').trim();
      const sentenceMatch = clean.match(/^([^.?!]+[.?!])/);
      if (sentenceMatch && sentenceMatch[1]) {
        clean = sentenceMatch[1].trim();
      } else if (!clean.endsWith('.')) {
        clean = `${clean}.`;
      }
      parsed.feedback = clean;
    }

    return parsed;
  }

  private async routeResults(submission: AssignmentSubmissionEntity, assignment: AssignmentEntity, questionScores: any[], hasError: boolean) {
    const totalScore = questionScores.reduce((sum, q) => sum + (Number(q.score) || 0), 0);
    const totalMaxScore = questionScores.reduce((sum, q) => sum + (Number(q.maxScore) || 0), 0);
    const overallRemark = this.generateOverallRemark(questionScores, totalScore, totalMaxScore);
    const hasManualReviewNeeded = questionScores.some(q => q.needsManualReview);

    const creatorRequiresManualReview = assignment.humanInterventionRequired;
    const shouldAutoRelease = !creatorRequiresManualReview && !hasManualReviewNeeded && !hasError;
    const recipientId = (assignment as any).dynamicRecipientId || assignment.createdBy?.id || (assignment as any).assignedBy?.id || (assignment as any).createdById;

    submission.aiQuestionScores = questionScores;
    submission.aiTotalScore = totalScore;
    submission.aiTotalMaxScore = totalMaxScore;
    submission.aiOverallRemark = overallRemark;
    submission.aiContextIncomplete = false;

    if (shouldAutoRelease) {
      const percentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
      const finalStatus = percentage < 40 ? 'NEEDS_IMPROVEMENT' : 'APPROVED';

      submission.status = finalStatus;
      submission.questionScores = questionScores;
      submission.totalScore = totalScore;
      submission.totalMaxScore = totalMaxScore;
      submission.overallRemark = overallRemark;
      submission.score = totalScore;
      submission.feedback = overallRemark;
      submission.evaluatedBy = { id: recipientId } as any;
      submission.evaluationMethod = 'ai_auto';
      submission.evaluatedAt = new Date();
      await this.submissionRepo.save(submission);

      await this.notificationService.create({
        userId: submission.trainee?.id,
        type: 'evaluation_completed',
        title: finalStatus === 'NEEDS_IMPROVEMENT' ? 'Assignment needs improvement' : 'Assignment evaluated',
        message: `Score: ${totalScore}/${totalMaxScore}. Remark: ${overallRemark}`,
        link: '/assignments',
        relatedEntityType: 'submission',
        relatedEntityId: submission.id,
      });
    } else {
      submission.status = 'ai_evaluated_pending_review';
      submission.evaluationMethod = 'ai_assisted';
      await this.submissionRepo.save(submission);

      await this.notificationService.create({
        userId: recipientId,
        type: 'ai_evaluation_ready',
        title: `AI evaluated "${assignment.title}" — review needed`,
        message: `AI Score: ${totalScore}/${totalMaxScore}. Remark: ${overallRemark}`,
        link: '/evaluations',
        relatedEntityType: 'submission',
        relatedEntityId: submission.id,
      });
    }
  }

  private generateOverallRemark(questionScores: any[], totalScore: number, totalMaxScore: number): string {
    const percentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
    const mcqs = questionScores.filter(q => q.type === 'mcq');
    const correctMcqs = mcqs.filter(q => Number(q.score) > 0);
    const subj = questionScores.filter(q => q.type !== 'mcq');

    const firstSubjRemark = subj.find(q => q.remark && !q.remark.toLowerCase().includes('evaluation failed'))?.remark;

    if (firstSubjRemark) {
      let clean = firstSubjRemark.replace(/[`*"]/g, '').replace(/\s+/g, ' ').trim();
      const match = clean.match(/^([^.?!]+[.?!])/);
      if (match && match[1]) {
        clean = match[1].trim();
      } else if (!clean.endsWith('.')) {
        clean = `${clean}.`;
      }
      return clean;
    }

    if (mcqs.length > 0) {
      return correctMcqs.length === mcqs.length
        ? `All ${mcqs.length} multiple choice questions were answered correctly.`
        : `Answered ${correctMcqs.length} of ${mcqs.length} multiple choice questions correctly.`;
    }

    if (percentage >= 80) {
      return 'Accurately completes the assignment demonstrating solid technical understanding.';
    } else if (percentage >= 50) {
      return 'Shows partial technical understanding but misses several key configuration requirements.';
    } else {
      return 'Submission lacks required technical details and misses essential core concepts.';
    }
  }

  private async fallbackToManualReview(submissionId: string, jobId: string, errorMessage: string) {
    const submission = await this.submissionRepo.findOne({ where: { id: submissionId }, relations: ['assignment', 'assignment.createdBy'] });
    if (!submission) return;
    const recipientId = submission.assignment?.createdBy?.id || (submission.assignment as any)?.assignedBy?.id;
    if (!recipientId) return;

    submission.status = 'pending_manual_review';
    submission.aiEvaluationError = true;
    submission.evaluationMethod = 'manual';
    await this.submissionRepo.save(submission);
    
    await this.notificationService.create({
      userId: recipientId,
      type: 'ai_evaluation_failed',
      title: `AI evaluation failed`,
      message: `Error: ${errorMessage}`,
      link: '/evaluations',
      relatedEntityType: 'submission',
      relatedEntityId: submissionId,
    });
  }
}
