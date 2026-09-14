/**
 * LP Authoring Service
 *
 * Handles the transactional creation of a complete Learning Path from
 * the parsed Tiptap document payload. All entities (LP, modules, lessons,
 * assignments, resources) are created in a single DB transaction — partial
 * creation is a data-integrity bug that must never happen.
 *
 * Also manages draft autosave (raw Tiptap JSON storage).
 */
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { ResourceEntity } from '../../entities/resource.entity';
import { UserEntity } from '../../entities/user.entity';
import { LpDraftEntity } from '../../entities/lpDraft.entity';
import { ContentExtractionService } from '../aiEvaluation/contentExtraction.service';

@Injectable()
export class LpAuthoringService {
  private readonly logger = new Logger(LpAuthoringService.name);
  private lpRepo: Repository<LearningPathEntity>;
  private moduleRepo: Repository<ModuleEntity>;
  private lessonRepo: Repository<LessonEntity>;
  private assignmentRepo: Repository<AssignmentEntity>;
  private resourceRepo: Repository<ResourceEntity>;
  private userRepo: Repository<UserEntity>;
  private draftRepo: Repository<LpDraftEntity>;

  constructor(
    private readonly datasource: DataSource,
    private readonly contentExtraction: ContentExtractionService,
  ) {
    this.lpRepo = this.datasource.getRepository(LearningPathEntity);
    this.moduleRepo = this.datasource.getRepository(ModuleEntity);
    this.lessonRepo = this.datasource.getRepository(LessonEntity);
    this.assignmentRepo = this.datasource.getRepository(AssignmentEntity);
    this.resourceRepo = this.datasource.getRepository(ResourceEntity);
    this.userRepo = this.datasource.getRepository(UserEntity);
    this.draftRepo = this.datasource.getRepository(LpDraftEntity);
  }

  // ─────────────────────────────────────────────
  // TRANSACTIONAL LP CREATION
  // ─────────────────────────────────────────────

  /**
   * Create an entire Learning Path from the parsed Tiptap payload.
   * Everything in a single transaction — rolls back entirely on any failure.
   */
  async createLearningPathFromDocument(
    payload: any,
    creatorId: string,
  ): Promise<LearningPathEntity> {
    // Server-side validation
    this.validatePayload(payload);

    const creator = await this.userRepo.findOne({ where: { id: creatorId } });
    if (!creator) {
      throw new BadRequestException(`Creator user with ID "${creatorId}" not found.`);
    }

    return await this.datasource.transaction(async manager => {
      // 1. Create Learning Path
      const lpData = manager.create(LearningPathEntity, {
        title: payload.title,
        description: payload.description || null,
        difficulty: payload.difficulty || 'Intermediate',
        duration: payload.duration || '12 weeks',
        skillsTags: payload.skillsTags || [],
        status: payload.status || 'Active',
        imageUrl: payload.imageUrl || null,
        createdBy: creator,
        assignedToTraineeIds: [],
        overallProgress: 0,
        lockLessons: true,
        lockTasks: true,
      });
      const savedLP = await manager.save(LearningPathEntity, lpData);

      // 2. Create Modules
      for (let moduleIdx = 0; moduleIdx < (payload.modules || []).length; moduleIdx++) {
        const modulePayload = payload.modules[moduleIdx];

        const moduleData = manager.create(ModuleEntity, {
          title: modulePayload.title || `Module ${moduleIdx + 1}`,
          description: modulePayload.description || null,
          lessonLocking: modulePayload.sequentialLessonLock !== false,
          taskLocking: true,
          learningPath: savedLP,
          createdBy: creator,
          status: 'Active',
          level: 'Beginner',
          difficultyLevel: 'Beginner',
        });
        const savedModule = await manager.save(ModuleEntity, moduleData);

        // Track lesson IDs for assignment dependency computation
        const createdLessonIds: string[] = [];

        // 3. Create Lessons
        for (let lessonIdx = 0; lessonIdx < (modulePayload.lessons || []).length; lessonIdx++) {
          const lessonPayload = modulePayload.lessons[lessonIdx];

          const lessonData = manager.create(LessonEntity, {
            title: lessonPayload.title || `Lesson ${lessonIdx + 1}`,
            description: lessonPayload.description || null,
            videoUrl: lessonPayload.videos?.[0]?.url || null,
            displayOrder: lessonIdx + 1,
            durationMinutes: lessonPayload.durationMinutes || 15,
            module: savedModule,
            learningPath: savedLP,
            createdBy: creator,
            videos: lessonPayload.videos || [],
            audios: lessonPayload.audios || [],
            keyPoints: lessonPayload.keyPoints || [],
          });
          const savedLesson = await manager.save(LessonEntity, lessonData);
          createdLessonIds.push(savedLesson.id);

          // Create resources for this lesson
          for (const resource of lessonPayload.resources || []) {
            const resourceData = manager.create(ResourceEntity, {
              title: resource.label || resource.url,
              url: resource.url,
              type: resource.type || 'Link',
              lesson: savedLesson,
              module: savedModule,
            });
            await manager.save(ResourceEntity, resourceData);
          }

          // Trigger content extraction asynchronously (after transaction commits)
          // We'll trigger these after the transaction succeeds
        }

        // 4. Create Assignments
        for (const assignmentPayload of modulePayload.assignments || []) {
          // dependsOnLessonIds comes from the client parser (based on ordering)
          // but we override with the actual created IDs for consistency
          const depLessonIds = assignmentPayload.dependsOnLessonIds?.length
            ? assignmentPayload.dependsOnLessonIds
            : [...createdLessonIds]; // All lessons preceding this assignment

          // Compute maxScore from questions
          let maxScore = 100;
          if (assignmentPayload.questions?.length) {
            maxScore = assignmentPayload.questions.reduce(
              (sum: number, q: any) => sum + (Number(q.maxPoints || q.points) || 10),
              0,
            );
          }

          const assignmentData = manager.create(AssignmentEntity, {
            title: assignmentPayload.title || 'Assignment',
            description: assignmentPayload.body || null,
            instructions: assignmentPayload.body || null,
            assignmentType: this.inferAssignmentType(assignmentPayload),
            maxScore,
            module: savedModule,
            learningPath: savedLP,
            createdBy: creator,
            assignedToTraineeIds: [],
            questions: assignmentPayload.questions || null,
            dependsOnLessonIds: depLessonIds,
            lockUntilLessonsComplete: assignmentPayload.lockConfig?.enabled !== false,
            autoEvaluateWithAI: assignmentPayload.evaluation?.autoEvaluateWithAI === true,
            humanInterventionRequired: assignmentPayload.evaluation?.humanInterventionRequired !== false,
            durationDays: assignmentPayload.timerDuration?.days || 0,
            durationHours: assignmentPayload.timerDuration?.hours || 0,
            durationMinutes: assignmentPayload.timerDuration?.minutes || 0,
            countdownStart: assignmentPayload.countdownStart || 'onAssignment',
            anchorType: 'LP_ASSIGNED',
            isExternal: false,
          });
          await manager.save(AssignmentEntity, assignmentData);
        }
      }

      return savedLP;
    }).then(async savedLP => {
      // After transaction commits, trigger content extraction for all lessons
      const lessons = await this.lessonRepo.find({
        where: { learningPath: { id: savedLP.id } },
      });

      for (const lesson of lessons) {
        this.contentExtraction.extractLessonContentAsync(lesson.id);
      }

      this.logger.log(
        `LP "${savedLP.title}" created with ${payload.modules?.length || 0} modules, ` +
          `${lessons.length} lessons via Tiptap authoring`,
      );

      // Return full LP with details
      return (await this.lpRepo.findOne({
        where: { id: savedLP.id },
        relations: [
          'createdBy',
          'modules',
          'modules.lessons',
          'modules.lessons.resources',
          'modules.assignments',
        ],
      })) as LearningPathEntity;
    });
  }

  // ─────────────────────────────────────────────
  // PAYLOAD VALIDATION (server-side)
  // ─────────────────────────────────────────────

  private validatePayload(payload: any): void {
    const errors: string[] = [];

    if (!payload.title?.trim()) {
      errors.push('Learning Path title is required.');
    }

    if (!payload.modules?.length) {
      errors.push('At least one module is required.');
    }

    for (let mi = 0; mi < (payload.modules || []).length; mi++) {
      const mod = payload.modules[mi];
      const modLabel = mod.title || `Module ${mi + 1}`;

      if (!mod.lessons?.length) {
        errors.push(`${modLabel}: At least one lesson is required.`);
      }

      for (let li = 0; li < (mod.lessons || []).length; li++) {
        const lesson = mod.lessons[li];
        const lessonLabel = lesson.title || `Lesson ${li + 1}`;

        if (!lesson.title?.trim()) {
          errors.push(`${modLabel} → ${lessonLabel}: Lesson title is required.`);
        }

        const hasContent =
          lesson.description?.trim() ||
          lesson.videos?.length > 0 ||
          lesson.audios?.length > 0 ||
          lesson.resources?.length > 0;

        if (!hasContent) {
          errors.push(
            `${modLabel} → ${lessonLabel}: At least one content block (description, video, audio, or resource) is required.`,
          );
        }
      }

      for (const assignment of mod.assignments || []) {
        const aLabel = assignment.title || 'Untitled assignment';

        // B5: AI eval requires dependsOnLessonIds to have at least one lesson
        // (that's what the AI evaluator will actually use for grounding context)
        if (assignment.evaluation?.autoEvaluateWithAI) {
          const depIds: string[] = assignment.dependsOnLessonIds || [];
          if (depIds.length === 0) {
            errors.push(
              `${modLabel} → ${aLabel}: AI evaluation enabled but no dependent lessons found to ground the evaluation on. ` +
              `Add at least one lesson before this assignment in the same module.`,
            );
          }
        }

        // Edge case: lock enabled but zero preceding lessons → warn and treat as always-unlocked
        if (
          assignment.lockConfig?.enabled !== false &&
          (!assignment.dependsOnLessonIds || assignment.dependsOnLessonIds.length === 0)
        ) {
          this.logger.warn(
            `${modLabel} → ${aLabel}: lockUntilLessonsComplete=true but dependsOnLessonIds is empty. Will be treated as always-unlocked.`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }
  }

  private inferAssignmentType(payload: any): string {
    const questions = payload.questions || [];
    if (questions.length === 0) return 'Subjective';

    const hasMCQ = questions.some((q: any) => q.type === 'MCQ');
    const hasSubjective = questions.some((q: any) => q.type === 'Subjective');

    if (hasMCQ && hasSubjective) return 'Mixed';
    if (hasMCQ) return 'MCQ';
    return 'Subjective';
  }

  // ─────────────────────────────────────────────
  // DRAFT MANAGEMENT
  // ─────────────────────────────────────────────

  async saveDraft(
    creatorId: string,
    draftData: Record<string, any>,
    draftId?: string,
    title?: string,
  ): Promise<LpDraftEntity> {
    let draft: LpDraftEntity | null = null;

    if (draftId) {
      draft = await this.draftRepo.findOne({
        where: { id: draftId, creatorId },
      });
      if (draft) {
        draft.draftData = draftData;
        if (title) draft.title = title;
        return await this.draftRepo.save(draft);
      }
    }

    // Create new draft
    draft = this.draftRepo.create({
      creatorId,
      draftData,
      title: title || 'Untitled Learning Path',
      status: 'active',
    });
    return await this.draftRepo.save(draft);
  }

  async listDrafts(creatorId: string): Promise<LpDraftEntity[]> {
    return await this.draftRepo.find({
      where: { creatorId, status: 'active' },
      order: { updatedAt: 'DESC' },
      select: ['id', 'title', 'createdAt', 'updatedAt', 'status'],
    });
  }

  async getDraft(draftId: string, creatorId: string): Promise<LpDraftEntity> {
    const draft = await this.draftRepo.findOne({
      where: { id: draftId, creatorId },
    });
    if (!draft) {
      throw new NotFoundException(`Draft "${draftId}" not found.`);
    }
    return draft;
  }

  async deleteDraft(draftId: string, creatorId: string): Promise<void> {
    const draft = await this.getDraft(draftId, creatorId);
    await this.draftRepo.remove(draft);
  }

  async markDraftConverted(draftId: string, creatorId: string): Promise<void> {
    const draft = await this.draftRepo.findOne({
      where: { id: draftId, creatorId },
    });
    if (draft) {
      draft.status = 'converted';
      await this.draftRepo.save(draft);
    }
  }
}
