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

  private readonly MODEL = process.env.GROQ_EVAL_MODEL || 'openai/gpt-oss-safeguard-20b';
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

      const questions = assignment.questions || [];
      let submittedAnswers: any[] = submission?.answers || [];

      if ((!submittedAnswers || submittedAnswers.length === 0) && submission.submissionText) {
        try {
          const parsed = JSON.parse(submission.submissionText);
          if (parsed && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers)) {
            submittedAnswers = Object.entries(parsed.answers).map(([key, value]) => {
              const idx = parseInt(key, 10);
              const q = (!isNaN(idx) && questions[idx]) ? questions[idx] : questions.find(q => String(q.id) === key);
              return {
                questionId: q ? q.id : key,
                answer: typeof value === 'string' ? value : (value as any)?.answer || JSON.stringify(value),
              };
            });
          } else if (Array.isArray(parsed)) {
            submittedAnswers = parsed;
          } else {
            submittedAnswers = questions.map(q => ({ questionId: q.id, answer: submission.submissionText }));
          }
        } catch (e) {
          submittedAnswers = questions.map(q => ({ questionId: q.id, answer: submission.submissionText }));
        }
      }

      const rubricCache = new Map();
      const evaluationPromises = questions.map(q => {
        const ans = submittedAnswers.find(a => String(a.questionId) === String(q.id));
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

  private async evaluateQuestion(question: any, answer: any, assignment: AssignmentEntity, rubricCache: Map<string, any>) {
    if (String(question.type || '').toLowerCase() === 'mcq') {
      const expectedOption = question.options?.[question.correctIndex];
      const isCorrect = answer && String(answer.answer || answer.selectedOption || '').toLowerCase().trim() === String(expectedOption || '').toLowerCase().trim();
      return {
        questionId: question.id,
        score: isCorrect ? question.maxPoints : 0,
        maxScore: question.maxPoints,
        remark: isCorrect ? 'Correct answer.' : `Incorrect. The correct answer is: ${expectedOption}`,
        type: 'mcq',
        confidence: 1.0,
        groundingSource: 'deterministic',
        needsManualReview: false
      };
    }

    const answerText = String(answer?.answer || '').trim();
    if (!answerText || answerText.length < 5) {
      return {
        questionId: question.id,
        score: 0,
        maxScore: question.maxPoints,
        remark: 'No meaningful answer provided. Automatically scored 0.',
        type: 'subjective',
        confidence: 1.0,
        groundingSource: 'no_answer',
        needsManualReview: false
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
      maxScore: question.maxPoints,
      remark: parsedResult.feedback,
      type: 'subjective',
      confidence: parsedResult.confidence,
      groundingSource: context.groundingSourcePlan === 'module_fallback' ? 'module_fallback' : parsedResult.groundingSource,
      needsManualReview: parsedResult.confidence < 0.75, // Simple confidence gating
      contentVersionsUsed: context.contentVersionsUsed
    };
  }

  private async callGroqForQuestion(question: any, answerText: string, context: EvaluationContext, assignment: AssignmentEntity) {
    if (!this.MODEL || !this.API_KEY) throw new Error('GROQ config missing');

    const systemPrompt = `You are an expert evaluator grading a trainee's answer. Grade for MEANING, not exact wording. Semantic correctness matters more than word overlap.
    
INSTRUCTIONS:
1. Grade primarily against the Rubric.
2. If the trainee's answer contains a claim NOT covered by the Rubric, check the Retrieved Source Passages before marking it wrong. If a passage supports the claim, credit it.
3. Score out of ${question.maxPoints}. Provide specific, constructive feedback.
4. IMPORTANT: DO NOT simply give 0 or full marks. You MUST calculate a partial score proportional to the correctness.

Return ONLY valid JSON matching this exact shape:
{
  "score": <number between 0 and maxScore>,
  "feedback": "<string>",
  "confidence": <0.0-1.0>,
  "groundingSource": "rubric" | "retrieved_passage" | "unsupported" | "no_lesson_dependency"
}`;

    const rubricStr = context.rubrics.map(r => `[Lesson: ${r.lessonName}]\n${r.keyPoints.map((kp: any) => `- ${kp.point}`).join('\n')}`).join('\n\n').substring(0, 4000);
    const chunksStr = context.retrievedChunks.map(c => `[From ${c.lessonName}]: "${c.chunkText}"`).join('\n\n').substring(0, 8000);
    const safeAnswerText = answerText.substring(0, 5000);

    const userPrompt = `QUESTION: ${question.text}\n\nTRAINEE'S ANSWER: ${safeAnswerText}\n\n--- Rubric ---\n${rubricStr || '[No rubric]'}\n\n--- Retrieved Source Passages ---\n${chunksStr || '[None]'}`;

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

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    let parsed: any;
    try {
       parsed = JSON.parse(data.choices?.[0]?.message?.content);
    } catch {
       throw new Error('Unparseable JSON');
    }
    
    // clamp score
    parsed.score = Math.min(Math.max(Number(parsed.score) || 0, 0), question.maxPoints);
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

  private generateOverallRemark(questionScores: any[], totalScore: number, totalMaxScore: number) {
    const percentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
    if (percentage >= 80) return `Excellent work! Score: ${totalScore}/${totalMaxScore}`;
    if (percentage >= 50) return `Good effort. Score: ${totalScore}/${totalMaxScore}`;
    return `Score: ${totalScore}/${totalMaxScore}. Needs improvement.`;
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
