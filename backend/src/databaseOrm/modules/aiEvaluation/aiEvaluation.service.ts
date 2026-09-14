/**
 * AI Evaluation Service
 *
 * Core pipeline for content-grounded AI evaluation of assignment submissions.
 *
 * Flow:
 * 1. MCQ questions → graded deterministically in code (never sent to AI)
 * 2. Subjective questions → build evaluation context from cached lesson content
 * 3. If context exceeds token budget → BM25-rank and truncate
 * 4. Call Groq API with structured JSON output
 * 5. Validate AI response (score ranges, ID matching, sum verification)
 * 6. Route result: human-review queue OR auto-release
 *
 * Never leaves a submission stuck: falls back to manual evaluation on repeated failure.
 */
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { UserEntity } from '../../entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { ContentExtractionService } from './contentExtraction.service';
import { Bm25Service } from './bm25.service';

interface QuestionScore {
  questionId: string;
  score: number;
  maxScore: number;
  remark: string;
}

interface AIEvaluationResult {
  questionScores: QuestionScore[];
  totalScore: number;
  totalMaxScore: number;
  overallRemark: string;
}

// ~32K tokens budget for Groq context (conservative for llama-3.3-70b-versatile)
const MODEL_CONTEXT_BUDGET = 28000;
const MAX_RETRIES = 3;

@Injectable()
export class AiEvaluationService {
  private readonly logger = new Logger(AiEvaluationService.name);
  private assignmentRepo: Repository<AssignmentEntity>;
  private submissionRepo: Repository<AssignmentSubmissionEntity>;
  private lessonRepo: Repository<LessonEntity>;
  private userRepo: Repository<UserEntity>;

  constructor(
    private readonly datasource: DataSource,
    private readonly contentExtraction: ContentExtractionService,
    private readonly bm25: Bm25Service,
    private readonly notificationService: NotificationService,
  ) {
    this.assignmentRepo = this.datasource.getRepository(AssignmentEntity);
    this.submissionRepo = this.datasource.getRepository(AssignmentSubmissionEntity);
    this.lessonRepo = this.datasource.getRepository(LessonEntity);
    this.userRepo = this.datasource.getRepository(UserEntity);
  }

  /**
   * Main entry point: evaluate a submission.
   * Called asynchronously after the trainee submits.
   */
  async evaluateSubmission(submissionId: string): Promise<void> {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: [
        'assignment',
        'assignment.createdBy',
        'assignment.module',
        'assignment.module.learningPath',
        'assignment.lesson',
        'assignment.lesson.module',
        'assignment.lesson.module.learningPath',
        'assignment.learningPath',
        'trainee',
      ],
    });

    if (!submission) {
      this.logger.error(`Submission ${submissionId} not found for AI evaluation`);
      return;
    }

    const assignment = submission.assignment;
    if (!assignment?.autoEvaluateWithAI) {
      this.logger.warn(`Assignment ${assignment?.id} does not have AI evaluation enabled`);
      return;
    }

    // Mark as pending
    submission.aiEvaluationStatus = 'pending';
    await this.submissionRepo.save(submission);

    try {
      // Step 1: Grade MCQ questions deterministically
      const mcqResults = this.gradeMCQQuestions(assignment, submission);

      // Step 2: Identify subjective questions that need AI grading
      const subjectiveQuestions = (assignment.questions || []).filter(
        q => q.type === 'Subjective',
      );

      let aiResult: AIEvaluationResult | null = null;
      let contextIncomplete = false;

      if (subjectiveQuestions.length > 0) {
        // Step 3: Build evaluation context
        const { context, incomplete } = await this.buildEvaluationContext(assignment);
        contextIncomplete = incomplete;

        // Step 4: Call Groq for subjective evaluation
        aiResult = await this.callGroqWithRetry(assignment, submission, context);
      }

      // Step 5: Merge MCQ + AI results
      const mergedResult = this.mergeResults(mcqResults, aiResult, assignment);

      // Step 6: Validate merged result
      const validatedResult = this.validateAndFixResult(mergedResult, assignment);

      // Step 7: Store result and route
      submission.aiEvaluationResult = validatedResult;
      submission.contextIncomplete = contextIncomplete;

      await this.routeResult(submission, validatedResult, contextIncomplete);
    } catch (e) {
      const err = e as Error;
      this.logger.error(
        `AI evaluation failed for submission ${submissionId}: ${err.message}`,
        err.stack,
      );
      await this.fallbackToManualEvaluation(submission, err.message);
    }
  }

  /**
   * Trainer reviews and releases an AI-evaluated submission.
   */
  async trainerReviewAndRelease(
    submissionId: string,
    trainerId: string,
    edits: { questionScores?: QuestionScore[]; overallRemark?: string },
  ): Promise<AssignmentSubmissionEntity> {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['assignment', 'trainee'],
    });

    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    // Apply trainer edits to the AI result
    const result = submission.aiEvaluationResult || {};
    if (edits.questionScores) {
      result.questionScores = edits.questionScores;
    }
    if (edits.overallRemark) {
      result.overallRemark = edits.overallRemark;
    }

    // Recompute total score from (possibly edited) question scores
    const totalScore = (result.questionScores || []).reduce(
      (sum: number, qs: any) => sum + (Number(qs.score) || 0),
      0,
    );
    result.totalScore = totalScore;

    submission.aiEvaluationResult = result;
    submission.score = totalScore;
    submission.feedback = result.overallRemark || '';
    submission.status = 'EVALUATED';
    submission.evaluatedAt = new Date();
    submission.evaluatedBy = { id: trainerId } as any;
    submission.evaluationMethod = 'ai_assisted';
    submission.aiEvaluationStatus = 'trainer_released'; // B11: Correctly marks trainer-reviewed release

    const saved = await this.submissionRepo.save(submission);

    // Notify trainee
    if (submission.trainee?.id) {
      const maxScore = submission.assignment?.maxScore || 100;
      const scorePercent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      await this.notificationService.create({
        userId: submission.trainee.id,
        type: 'evaluation_completed',
        title: scorePercent < 35 ? 'Assignment needs improvement' : 'Assignment evaluated',
        message: `"${submission.assignment?.title || 'Assignment'}" was evaluated. Score: ${totalScore}/${maxScore} (${scorePercent}%)`,
        link: '/assignments',
        relatedEntityType: 'submission',
        relatedEntityId: submissionId,
      });
    }

    return saved;
  }

  // ─────────────────────────────────────────────
  // Internal pipeline methods
  // ─────────────────────────────────────────────

  /**
   * Grade MCQ questions deterministically — never sent to AI.
   */
  private gradeMCQQuestions(
    assignment: AssignmentEntity,
    submission: AssignmentSubmissionEntity,
  ): QuestionScore[] {
    const mcqQuestions = (assignment.questions || []).filter(q => q.type === 'MCQ');
    const answers = submission.answers || [];

    return mcqQuestions.map(q => {
      const answer = answers.find(a => a.questionId === q.id);
      const selectedIndex = answer ? parseInt(answer.answer, 10) : -1;
      const isCorrect = selectedIndex === q.correctIndex;

      return {
        questionId: q.id,
        score: isCorrect ? q.maxPoints : 0,
        maxScore: q.maxPoints,
        remark: isCorrect ? 'Correct' : `Incorrect. The correct answer was option ${(q.correctIndex || 0) + 1}.`,
      };
    });
  }

  /**
   * Build evaluation context from cached lesson content.
   * Default path: full concatenation.
   * Fallback: BM25-ranked truncation if oversized.
   */
  private async buildEvaluationContext(
    assignment: AssignmentEntity,
  ): Promise<{ context: string; incomplete: boolean }> {
    const dependsOnLessonIds = assignment.dependsOnLessonIds || [];
    if (dependsOnLessonIds.length === 0) {
      return { context: '', incomplete: true };
    }

    const lessons = await this.lessonRepo
      .createQueryBuilder('lesson')
      .where('lesson.id IN (:...ids)', { ids: dependsOnLessonIds })
      .getMany();

    const cachedContent = await this.contentExtraction.getCachedContent(
      dependsOnLessonIds,
    );

    let hasIncompleteContent = false;
    const contextParts: string[] = [];

    for (const lesson of lessons) {
      const cache = cachedContent.get(lesson.id);

      if (!cache || cache.extractionStatus === 'failed') {
        hasIncompleteContent = true;
        this.logger.warn(`Lesson ${lesson.id} has no cached content for AI evaluation`);
      }

      const parts = [
        `## Lesson: ${lesson.title}`,
        cache?.descriptionText || (lesson.description ? this.stripHtml(lesson.description) : ''),
        cache?.videoTranscript ? `### Video content:\n${cache.videoTranscript}` : '',
        cache?.audioTranscript ? `### Audio content:\n${cache.audioTranscript}` : '',
        cache?.resourceText ? `### Resource content:\n${cache.resourceText}` : '',
      ].filter(Boolean);

      contextParts.push(parts.join('\n\n'));
    }

    let fullContext = contextParts.join('\n\n---\n\n');

    const estimatedTokens = this.bm25.estimateTokens(fullContext);

    if (estimatedTokens > MODEL_CONTEXT_BUDGET) {
      this.logger.log(
        `Context exceeds budget (${estimatedTokens} tokens). Applying BM25 truncation.`,
      );

      // Build query from assignment questions
      const queryText = (assignment.questions || [])
        .filter(q => q.type === 'Subjective')
        .map(q => q.text)
        .join(' ');

      const chunks = this.bm25.splitIntoChunks(fullContext);
      const ranked = this.bm25.rank(chunks, queryText);
      fullContext = this.bm25.selectWithinBudget(ranked, MODEL_CONTEXT_BUDGET);
    }

    return {
      context: fullContext,
      incomplete: hasIncompleteContent,
    };
  }

  /**
   * Call Groq API with retry logic and exponential backoff.
   */
  private async callGroqWithRetry(
    assignment: AssignmentEntity,
    submission: AssignmentSubmissionEntity,
    context: string,
  ): Promise<AIEvaluationResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.callGroq(assignment, submission, context);
      } catch (e) {
        const err = e as Error;
        lastError = err;
        this.logger.warn(
          `Groq evaluation attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`,
        );

        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          await this.sleep(1000 * Math.pow(2, attempt - 1));
        }
      }
    }

    throw lastError || new Error('Groq evaluation failed after max retries');
  }

  /**
   * Single Groq API call for subjective question evaluation.
   */
  private async callGroq(
    assignment: AssignmentEntity,
    submission: AssignmentSubmissionEntity,
    context: string,
  ): Promise<AIEvaluationResult> {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const subjectiveQuestions = (assignment.questions || []).filter(
      q => q.type === 'Subjective',
    );

    const answers = submission.answers || [];

    const questionsAndAnswers = subjectiveQuestions
      .map(q => {
        const answer = answers.find(a => a.questionId === q.id);
        return `Question (ID: ${q.id}, Max Score: ${q.maxPoints}):\n${q.text}\n\nTrainee's Answer:\n${answer?.answer || '(No answer provided)'}`;
      })
      .join('\n\n---\n\n');

    const systemPrompt = `You are evaluating a trainee's assignment submission. Base your evaluation ONLY on
the lesson content provided below and the assignment questions. Do not use outside
knowledge beyond what's needed to assess correctness of concepts actually taught here.

For each question, return a score out of its max marks and a short remark.
Respond ONLY with valid JSON matching this shape:
{
  "questionScores": [{ "questionId": "...", "score": number, "maxScore": number, "remark": "..." }],
  "totalScore": number,
  "totalMaxScore": number,
  "overallRemark": "..."
}`;

    const userPrompt = `LESSON CONTENT:
${context}

ASSIGNMENT QUESTIONS AND TRAINEE ANSWERS:
${questionsAndAnswers}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Groq API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Groq returned empty response');
    }

    try {
      return JSON.parse(content) as AIEvaluationResult;
    } catch {
      throw new Error(`Failed to parse Groq JSON response: ${content.slice(0, 200)}`);
    }
  }

  /**
   * Merge MCQ (deterministic) results with AI (subjective) results.
   */
  private mergeResults(
    mcqResults: QuestionScore[],
    aiResult: AIEvaluationResult | null,
    assignment: AssignmentEntity,
  ): AIEvaluationResult {
    const allScores = [
      ...mcqResults,
      ...(aiResult?.questionScores || []),
    ];

    const totalScore = allScores.reduce((sum, qs) => sum + qs.score, 0);
    const totalMaxScore = allScores.reduce((sum, qs) => sum + qs.maxScore, 0);

    return {
      questionScores: allScores,
      totalScore,
      totalMaxScore,
      overallRemark: aiResult?.overallRemark || 'Evaluation completed.',
    };
  }

  /**
   * Validate and fix the AI result before it touches real data.
   * - Clamp scores to valid ranges
   * - Recompute totalScore (don't trust model arithmetic)
   * - Drop unknown questionIds
   * - Require both score and remark
   */
  private validateAndFixResult(
    result: AIEvaluationResult,
    assignment: AssignmentEntity,
  ): AIEvaluationResult {
    const validQuestionIds = new Set(
      (assignment.questions || []).map(q => q.id),
    );

    const validatedScores = (result.questionScores || [])
      .filter(qs => validQuestionIds.has(qs.questionId))
      .map(qs => {
        const maxScore = (assignment.questions || []).find(
          q => q.id === qs.questionId,
        )?.maxPoints || qs.maxScore;

        return {
          questionId: qs.questionId,
          score: Math.max(0, Math.min(Number(qs.score) || 0, maxScore)),
          maxScore,
          remark: qs.remark || 'No remark provided.',
        };
      });

    // Recompute total (never trust the model's sum)
    const totalScore = validatedScores.reduce((sum, qs) => sum + qs.score, 0);
    const totalMaxScore = validatedScores.reduce((sum, qs) => sum + qs.maxScore, 0);

    return {
      questionScores: validatedScores,
      totalScore,
      totalMaxScore,
      overallRemark: result.overallRemark || 'Evaluation completed.',
    };
  }

  /**
   * Route the validated result based on assignment toggles.
   */
  private async routeResult(
    submission: AssignmentSubmissionEntity,
    result: AIEvaluationResult,
    contextIncomplete: boolean,
  ): Promise<void> {
    const assignment = submission.assignment;
    const humanRequired =
      assignment.humanInterventionRequired || contextIncomplete;

    // Resolve the assigner (trainer who assigned this item)
    const assignerId = await this.resolveAssignerId(assignment, submission.trainee?.id);

    if (humanRequired) {
      // Human review path
      submission.aiEvaluationStatus = 'ai_evaluated_pending_review';
      submission.status = 'SUBMITTED'; // Keep in submitted state for trainer
      submission.aiEvaluationResult = result;
      await this.submissionRepo.save(submission);

      // Notify trainer
      if (assignerId) {
        const message = contextIncomplete
          ? `AI evaluation ready for review (⚠️ some lesson content was unavailable during evaluation)`
          : `AI evaluation ready for review`;

        await this.notificationService.create({
          userId: assignerId,
          type: 'ai_evaluation_ready',
          title: 'AI evaluation ready for review',
          message: `"${assignment.title}" — ${message}`,
          link: '/assignments?status=pending',
          relatedEntityType: 'submission',
          relatedEntityId: submission.id,
        });
      }
    } else {
      // Auto-release path
      submission.aiEvaluationStatus = 'ai_auto_released';
      submission.status = 'EVALUATED';
      submission.score = result.totalScore;
      submission.feedback = result.overallRemark;
      submission.evaluatedAt = new Date();
      submission.evaluationMethod = 'ai_auto';
      submission.aiEvaluationResult = result;

      // B12: Null-guard — only set evaluatedBy when assignerId is a valid non-empty string
      if (assignerId && assignerId.trim()) {
        submission.evaluatedBy = { id: assignerId } as any;
      }

      await this.submissionRepo.save(submission);

      // Notify trainee immediately
      if (submission.trainee?.id) {
        const maxScore = assignment.maxScore || result.totalMaxScore || 100;
        const scorePercent = maxScore > 0 ? Math.round((result.totalScore / maxScore) * 100) : 0;
        const needsImprovement = scorePercent < 35;

        await this.notificationService.create({
          userId: submission.trainee.id,
          type: 'evaluation_completed',
          title: needsImprovement ? 'Assignment needs improvement' : 'Assignment evaluated',
          message: `"${assignment.title}" was evaluated. Score: ${result.totalScore}/${maxScore} (${scorePercent}%)`,
          link: '/assignments',
          relatedEntityType: 'submission',
          relatedEntityId: submission.id,
        });
      }
    }
  }

  /**
   * Fallback: route to manual trainer evaluation when AI fails.
   */
  private async fallbackToManualEvaluation(
    submission: AssignmentSubmissionEntity,
    reason: string,
  ): Promise<void> {
    submission.aiEvaluationStatus = 'ai_evaluation_failed';
    submission.aiEvaluationResult = { error: reason } as any;
    await this.submissionRepo.save(submission);

    // Notify trainer
    const assignerId = await this.resolveAssignerId(
      submission.assignment,
      submission.trainee?.id,
    );

    if (assignerId && this.notificationService) {
      await this.notificationService.create({
        userId: assignerId,
        type: 'ai_evaluation_failed',
        title: 'AI evaluation failed — manual review needed',
        message: `AI evaluation failed for "${submission.assignment?.title}". Please evaluate manually. Reason: ${reason}`,
        link: '/assignments?status=pending',
        relatedEntityType: 'submission',
        relatedEntityId: submission.id,
      });
    }
  }

  /**
   * Resolve the trainer who assigned this assignment to the trainee.
   */
  private async resolveAssignerId(
    assignment: AssignmentEntity,
    traineeId?: string,
  ): Promise<string | null> {
    if (!assignment || !traineeId) return assignment?.createdBy?.id || null;

    // Try to find via enrollment (LP-based assignments)
    const enrollmentRepo = this.datasource.getRepository('EnrollmentEntity');
    let lpId =
      assignment.learningPath?.id ||
      (assignment as any).learningPathId ||
      assignment.module?.learningPath?.id ||
      assignment.lesson?.module?.learningPath?.id;

    if (lpId) {
      try {
        const enrollment = await enrollmentRepo.findOne({
          where: { learningPath: { id: lpId }, user: { id: traineeId } },
          relations: ['assignedBy'],
        });
        if (enrollment?.assignedBy?.id) return enrollment.assignedBy.id;
      } catch {
        // Fall through to default
      }
    }

    return assignment.createdBy?.id || null;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
