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
import { QuestionLessonDependencyEntity } from '../../entities/questionLessonDependency.entity';
import { ResourceEntity } from '../../entities/resource.entity';
import { UserEntity } from '../../entities/user.entity';
import { LpDraftEntity } from '../../entities/lpDraft.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { ContentExtractionService } from '../aiEvaluation/contentExtraction.service';
import { LearningPathEntityService } from '../learningPath/learningPath.service';
import { forwardRef, Inject } from '@nestjs/common';

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
    @Inject(forwardRef(() => LearningPathEntityService))
    private readonly LearningPathEntityService: LearningPathEntityService,
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

    const creator = await this.userRepo.findOne({ where: { id: creatorId }, relations: ['primaryRole'] });
    if (!creator) {
      throw new BadRequestException(`Creator user with ID "${creatorId}" not found.`);
    }

    return await this.datasource.transaction(async manager => {
      let savedLP: LearningPathEntity;

      if (payload.id) {
        // Upsert mode (Edit LP)
        const existingLP = await manager.findOne(LearningPathEntity, {
          where: { id: payload.id },
          relations: ['modules', 'modules.lessons', 'modules.lessons.assignments', 'modules.assignments', 'createdBy']
        });
        
        if (!existingLP) {
          throw new NotFoundException(`LP with ID ${payload.id} not found for edit`);
        }

        // Authorization check: Only Admin or the original creator can edit
        const ownerId = existingLP.createdBy?.id;
        const isAdmin = String(creator.primaryRole?.name || '').toLowerCase() === 'admin' || (creator.roles || []).some((r: any) => String(r.name).toLowerCase() === 'admin');
        if (!isAdmin && String(ownerId || '').toLowerCase() !== String(creatorId).toLowerCase()) {
          const { ForbiddenException } = await import('@nestjs/common');
          throw new ForbiddenException('Access Denied: Only the Learning Path Owner or an Admin can edit this path.');
        }
        
        existingLP.title = payload.title;
        existingLP.description = payload.description || null;
        existingLP.difficulty = payload.level ? payload.level.charAt(0).toUpperCase() + payload.level.slice(1) : (payload.difficulty || 'Intermediate');
        existingLP.status = payload.status ? payload.status.charAt(0).toUpperCase() + payload.status.slice(1) : (existingLP.status || 'Active');
        existingLP.duration = payload.duration || '12 weeks';
        existingLP.skillsTags = Array.isArray(payload.skillsTags)
          ? payload.skillsTags
          : (payload.skillsTags ? [payload.skillsTags] : []);
        savedLP = await manager.save(LearningPathEntity, existingLP);
        
        // Find ids to keep
        const incomingModuleIds = new Set(payload.modules?.map((m: any) => m.id).filter(Boolean));
        const incomingLessonIds = new Set(payload.modules?.flatMap((m: any) => m.lessons?.map((l: any) => l.id)).filter(Boolean));
        const incomingAssignmentIds = new Set(payload.modules?.flatMap((m: any) => m.assignments?.map((a: any) => a.id)).filter(Boolean));

        // Collect all assignments that are going to be deleted
        const assignmentsToDelete: string[] = [];

        for (const mod of existingLP.modules || []) {
          if (!incomingModuleIds.has(mod.id)) {
            assignmentsToDelete.push(...(mod.assignments?.map((a: any) => a.id) || []));
            for (const lesson of mod.lessons || []) {
              assignmentsToDelete.push(...(lesson.assignments?.map((a: any) => a.id) || []));
            }
          } else {
            for (const lesson of mod.lessons || []) {
              if (!incomingLessonIds.has(lesson.id)) {
                assignmentsToDelete.push(...(lesson.assignments?.map((a: any) => a.id) || []));
              }
            }
            for (const assignment of mod.assignments || []) {
              if (!incomingAssignmentIds.has(assignment.id)) {
                assignmentsToDelete.push(assignment.id);
              }
            }
          }
        }

        // Block if any submissions exist for these assignments
        if (assignmentsToDelete.length > 0) {
          const { In } = await import('typeorm');
          const submissionCount = await manager.count(AssignmentSubmissionEntity, {
            where: { assignment: { id: In(assignmentsToDelete) } }
          });

          if (submissionCount > 0) {
            throw new BadRequestException(
              'Cannot delete items that have existing trainee submissions. Please remove the trainee assignments or mark the items as deprecated instead.'
            );
          }
        }

        // Delete removed modules/lessons/assignments
        for (const mod of existingLP.modules || []) {
           if (!incomingModuleIds.has(mod.id)) {
              await manager.remove(mod);
           } else {
             for (const lesson of mod.lessons || []) {
               if (!incomingLessonIds.has(lesson.id)) {
                 await manager.remove(lesson);
               }
             }
             for (const assignment of mod.assignments || []) {
               if (!incomingAssignmentIds.has(assignment.id)) {
                 await manager.remove(assignment);
               }
             }
           }
        }
      } else {
        // Create mode
        const lpData = manager.create(LearningPathEntity, {
          title: payload.title,
          description: payload.description || null,
          difficulty: payload.level ? payload.level.charAt(0).toUpperCase() + payload.level.slice(1) : (payload.difficulty || 'Intermediate'),
          duration: payload.duration || '12 weeks',
          skillsTags: payload.skillsTags || [],
          status: payload.status ? payload.status.charAt(0).toUpperCase() + payload.status.slice(1) : 'Active',
          imageUrl: payload.imageUrl || null,
          createdBy: creator,
          assignedToTraineeIds: [],
          overallProgress: 0,
          lockLessons: true,
          lockTasks: true,
        });
        savedLP = await manager.save(LearningPathEntity, lpData);
      }

      // 2. Create/Update Modules
      let totalLpDays = 0;

      for (let moduleIdx = 0; moduleIdx < (payload.modules || []).length; moduleIdx++) {
        const modulePayload = payload.modules[moduleIdx];

        // 🌟 Duration Computation Logic
        let durationLabel = 'Duration not yet determined';
        let moduleDays = 0;
        let maxAssignmentMinutes = 0;
        
        if (modulePayload.assignments?.length > 0) {
          for (const a of modulePayload.assignments) {
            const mins = ((a.timerDuration?.days || 0) * 24 * 60) + ((a.timerDuration?.hours || 0) * 60) + (a.timerDuration?.minutes || 0);
            if (mins > maxAssignmentMinutes) {
              maxAssignmentMinutes = mins;
            }
          }
        }

        if (maxAssignmentMinutes > 0) {
          moduleDays = Math.ceil(maxAssignmentMinutes / (24 * 60));
          durationLabel = `${moduleDays} Days`;
        } else if (modulePayload.lessons?.length > 0) {
          const lessonMins = modulePayload.lessons.reduce((acc: number, l: any) => acc + Number(l.durationMinutes || 15), 0);
          if (lessonMins > 0) {
            if (lessonMins >= 60) {
              durationLabel = `${Math.round(lessonMins / 60)} Hours`;
              moduleDays = Math.max(1, Math.ceil(lessonMins / (24 * 60)));
            } else {
              durationLabel = `${lessonMins} Minutes`;
              moduleDays = 1;
            }
          }
        }

        totalLpDays += moduleDays;

        const moduleData = manager.create(ModuleEntity, {
          ...(modulePayload.id && /^[0-9a-f]{8}-/i.test(modulePayload.id) ? { id: modulePayload.id } : {}),
          title: modulePayload.title || `Module ${moduleIdx + 1}`,
          description: modulePayload.description || null,
          lessonLocking: modulePayload.sequentialLessonLock !== false,
          taskLocking: true,
          learningPath: savedLP,
          createdBy: creator,
          status: 'Active',
          level: 'Beginner',
          difficultyLevel: 'Beginner',
          durationLabel,
          durationWeeks: Math.ceil(moduleDays / 7) || 0,
          objectives: modulePayload.learningObjectives || [],
          outcomes: modulePayload.learningOutcomes || [],
        });
        const savedModule = await manager.save(ModuleEntity, moduleData);

        // Track lesson IDs for assignment dependency computation
        const createdLessonIds: string[] = [];
        const tempIdToRealId = new Map<string, string>();

        // 3. Create/Update Lessons
        for (let lessonIdx = 0; lessonIdx < (modulePayload.lessons || []).length; lessonIdx++) {
          const lessonPayload = modulePayload.lessons[lessonIdx];
          const lessonId = lessonPayload.id && /^[0-9a-f]{8}-/i.test(lessonPayload.id) ? lessonPayload.id : null;
          
          let existingLesson = null;
          if (lessonId) {
            existingLesson = await manager.findOne(LessonEntity, { where: { id: lessonId } });
          }

          const normalizeUrl = (url: string | null | undefined): string | null => {
            if (!url || !url.trim()) return null;
            const trimmed = url.trim();
            if (trimmed.toLowerCase().startsWith('javascript:') || trimmed.toLowerCase().startsWith('data:')) {
              throw new BadRequestException('Invalid URL scheme detected.');
            }
            if (!trimmed.toLowerCase().startsWith('http://') && !trimmed.toLowerCase().startsWith('https://')) {
              return `https://${trimmed}`;
            }
            return trimmed;
          };

          // Compute new values
          const newVideoUrl = normalizeUrl(lessonPayload.videos?.[0]?.url);
          const newVideos = (lessonPayload.videos || []).map((v: any) => ({ ...v, url: normalizeUrl(v.url) }));
          const newAudios = (lessonPayload.audios || []).map((a: any) => ({ ...a, url: normalizeUrl(a.url) }));
          const newResources = (lessonPayload.resources || []).map((r: any) => ({ ...r, url: normalizeUrl(r.url) }));

          const crypto = require('crypto');
          const sourceString = JSON.stringify({ v: newVideos, a: newAudios, r: newResources, d: lessonPayload.description });
          const newSourceHash = crypto.createHash('sha256').update(sourceString).digest('hex');

          let savedLesson;
          if (existingLesson) {
            const contentChanged = existingLesson.sourceHash !== newSourceHash;
            existingLesson.title = lessonPayload.title || `Lesson ${lessonIdx + 1}`;
            existingLesson.description = lessonPayload.description || null;
            existingLesson.videoUrl = newVideoUrl;
            existingLesson.displayOrder = lessonIdx + 1;
            existingLesson.durationMinutes = lessonPayload.durationMinutes || 15;
            existingLesson.videos = newVideos;
            existingLesson.audios = newAudios;
            existingLesson.keyPoints = lessonPayload.keyPoints || [];
            if (contentChanged) {
              existingLesson.contentVersion = (existingLesson.contentVersion || 1) + 1;
              existingLesson.sourceHash = newSourceHash;
            }
            savedLesson = await manager.save(LessonEntity, existingLesson);
          } else {
            const lessonData = manager.create(LessonEntity, {
              ...(lessonId ? { id: lessonId } : {}),
              title: lessonPayload.title || `Lesson ${lessonIdx + 1}`,
              description: lessonPayload.description || null,
              videoUrl: newVideoUrl,
              displayOrder: lessonIdx + 1,
              durationMinutes: lessonPayload.durationMinutes || 15,
              module: savedModule,
              learningPath: savedLP,
              createdBy: creator,
              videos: newVideos,
              audios: newAudios,
              keyPoints: lessonPayload.keyPoints || [],
              contentVersion: 1,
              sourceHash: newSourceHash,
            });
            savedLesson = await manager.save(LessonEntity, lessonData);
          }
          
          createdLessonIds.push(savedLesson.id);
          if (lessonPayload.id) {
            tempIdToRealId.set(lessonPayload.id, savedLesson.id);
          }

          // We should ideally remove old resources and recreate, or ignore for now if resources are updated in array.
          // For simplicity, if editing, we will just clear old resources for this lesson and recreate
          await manager.delete(ResourceEntity, { lesson: { id: savedLesson.id } });

          // Create resources for this lesson
          for (const resource of newResources) {
            if (!resource.url) continue;
            const resourceData = manager.create(ResourceEntity, {
              title: resource.label || resource.url,
              url: resource.url,
              type: resource.type || 'Link',
              lesson: savedLesson,
              module: savedModule,
            });
            await manager.save(ResourceEntity, resourceData);
          }
        }

        // 4. Create/Update Assignments
        for (const assignmentPayload of modulePayload.assignments || []) {
          // dependsOnLessonIds comes from the client parser
          let depLessonIds = [...createdLessonIds]; // fallback
          if (assignmentPayload.dependsOnLessonIds?.length) {
            depLessonIds = assignmentPayload.dependsOnLessonIds
              .map((tempId: string) => tempIdToRealId.get(tempId) || tempId) // Use tempId directly if it didn't map (means it's a real UUID already)
              .filter(Boolean) as string[];
              
            // If the map failed, fallback to all preceding lessons
            if (depLessonIds.length === 0 && createdLessonIds.length > 0) {
              depLessonIds = [...createdLessonIds];
            }
          }

          // Compute maxScore from questions
          let maxScore = 100;
          if (assignmentPayload.questions?.length) {
            maxScore = assignmentPayload.questions.reduce(
              (sum: number, q: any) => sum + (Number(q.maxPoints || q.points) || 10),
              0,
            );
          }

          const assignmentData = manager.create(AssignmentEntity, {
            ...(assignmentPayload.id && /^[0-9a-f]{8}-/i.test(assignmentPayload.id) ? { id: assignmentPayload.id } : {}),
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
            timerDuration: 
              ((assignmentPayload.timerDuration?.days || 0) * 24 * 60) +
              ((assignmentPayload.timerDuration?.hours || 0) * 60) +
              (assignmentPayload.timerDuration?.minutes || 0),
            anchorType: assignmentPayload.countdownStart === 'taskUnlocked' ? 'TASK_UNLOCKED' : 'LP_ASSIGNED',
            isExternal: false,
          });
          await manager.save(AssignmentEntity, assignmentData);
          
          const seenQuestionIds = new Set<string>();
          if (assignmentPayload.questions && assignmentPayload.questions.length > 0) {
            for (const q of assignmentPayload.questions) {
              // Prevent duplicate question IDs from Tiptap copy-paste
              if (seenQuestionIds.has(q.id)) {
                const crypto = require('crypto');
                q.id = crypto.randomUUID();
              }
              seenQuestionIds.add(q.id);

              // Clear existing dependencies to prevent unique constraint violations on update
              if (q.id) {
                await manager.delete(QuestionLessonDependencyEntity, { questionId: q.id });
              }

              if (q.requiresLessonGrounding !== false && q.lessonDependencies && q.lessonDependencies.length > 0) {
                // Save dependencies (deduplicated)
                const validDeps = Array.from(new Set(q.lessonDependencies.filter((id: string) => depLessonIds.includes(id))));
                const depsToSave = validDeps.map((lessonId: any) => 
                  manager.create(QuestionLessonDependencyEntity, {
                    questionId: q.id,
                    lesson: { id: lessonId } as any,
                    source: 'creator'
                  })
                );
                if (depsToSave.length > 0) {
                  await manager.save(QuestionLessonDependencyEntity, depsToSave);
                }
              }
            }
          }
          
          // Re-save assignment if we mutated any question IDs
          assignmentData.questions = assignmentPayload.questions;
          await manager.save(AssignmentEntity, assignmentData);
        }
      }

      savedLP.duration = totalLpDays > 0 ? `${Math.ceil(totalLpDays / 7)} weeks` : '0 weeks';
      delete (savedLP as any).modules; // Prevent TypeORM from cascading the old state of relations and reverting our updates
      await manager.save(LearningPathEntity, savedLP);

      return savedLP;
    }).then(async savedLP => {
      // After transaction commits, trigger content extraction for all lessons
      const lessons = await this.lessonRepo.find({
        where: { learningPath: { id: savedLP.id } },
      });

      for (const lesson of lessons) {
        this.contentExtraction.extractLessonContentAsync(lesson.id);
      }

      // 🌟 Fix: Re-run trainee assignment fan-out so new assignments get submissions for enrolled trainees
      // And update deadlines/lock statuses for existing incomplete submissions.
      if (savedLP.assignedToTraineeIds?.length > 0) {
        for (const traineeId of savedLP.assignedToTraineeIds) {
          try {
            await this.LearningPathEntityService.syncPathAssignments(savedLP.id, traineeId);
          } catch (err) {
            this.logger.error(`Failed to sync updated tasks for trainee ${traineeId} in LP ${savedLP.id}`, err);
          }
        }
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
          'modules.resources',
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
