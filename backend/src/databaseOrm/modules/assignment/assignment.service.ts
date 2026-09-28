import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { BaseService } from '../../../common/services/base.service';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { QuestionLessonDependencyEntity } from '../../entities/questionLessonDependency.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { TraineeAssignmentEntity } from '../../entities/traineeAssignment.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { EnrollmentEntity } from '../../entities/enrollment.entity';
import { UserEntity } from '../../entities/user.entity';
import { UserLessonProgressEntity } from '../../entities/userLessonProgress.entity';
import { isAssignmentUnlocked } from '../../../shared/lockLogic';
import { NotificationService } from '../notification/notification.service';
// B1: Lazy import via forwardRef to avoid circular dependency
import type { AiEvaluationService } from '../aiEvaluation/aiEvaluation.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isExternalAssignment(dtoOrEntity: {
  assignmentType?: string;
  lessonId?: string;
  moduleId?: string;
  learningPathId?: string;
  lesson?: { id?: string } | null;
  module?: { id?: string } | null;
  learningPath?: { id?: string } | null;
}): boolean {
  const type = String(dtoOrEntity.assignmentType || '').toLowerCase();
  if (type === 'external') return true;
  const hasLesson = !!(dtoOrEntity.lessonId || dtoOrEntity.lesson?.id);
  const hasModule = !!(dtoOrEntity.moduleId || dtoOrEntity.module?.id);
  const hasPath = !!(
    dtoOrEntity.learningPathId || dtoOrEntity.learningPath?.id
  );
  return !hasLesson && !hasModule && !hasPath;
}

@Injectable()
export class AssignmentEntityService extends BaseService<AssignmentEntity> {
  protected repository: Repository<AssignmentEntity>;
  private submissionRepository: Repository<AssignmentSubmissionEntity>;
  private questionLessonDepRepository: Repository<QuestionLessonDependencyEntity>;
  private traineeAssignmentRepository: Repository<TraineeAssignmentEntity>;
  private lessonRepository: Repository<LessonEntity>;
  private moduleRepository: Repository<ModuleEntity>;
  private learningPathRepository: Repository<LearningPathEntity>;
  private enrollmentRepository: Repository<EnrollmentEntity>;
  private userRepository: Repository<UserEntity>;
  private userLessonProgressRepo: Repository<UserLessonProgressEntity>;

  constructor(
    private readonly datasource: DataSource,
    @Optional()
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService?: NotificationService,
    // B1: AiEvaluationService injected via forwardRef to avoid circular dep
    @Optional()
    @Inject(forwardRef(() => 'AiEvaluationService'))
    private readonly aiEvaluationService?: AiEvaluationService,
  ) {
    super();
    this.repository =
      this.datasource.getRepository<AssignmentEntity>(AssignmentEntity);
    this.userRepository = this.datasource.getRepository<UserEntity>(UserEntity);
    this.submissionRepository =
      this.datasource.getRepository<AssignmentSubmissionEntity>(
        AssignmentSubmissionEntity,
      );
    this.traineeAssignmentRepository =
      this.datasource.getRepository<TraineeAssignmentEntity>(
        TraineeAssignmentEntity,
      );
    this.lessonRepository =
      this.datasource.getRepository<LessonEntity>(LessonEntity);
    this.moduleRepository =
      this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.learningPathRepository =
      this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
    this.enrollmentRepository =
      this.datasource.getRepository<EnrollmentEntity>(EnrollmentEntity);
    this.userLessonProgressRepo =
      this.datasource.getRepository<UserLessonProgressEntity>(
        UserLessonProgressEntity,
      );
  }

  private extractUserRoles(user: any): string[] {
    if (user?.activeRole) {
      return [String(user.activeRole).toLowerCase()];
    }
    const roles: string[] = [];
    const push = (v: any) => {
      if (!v) return;
      if (typeof v === 'string') roles.push(v.toLowerCase());
      else if (v?.name) roles.push(String(v.name).toLowerCase());
    };
    push(user?.role);
    push(user?.primaryRole);
    if (Array.isArray(user?.roles)) user.roles.forEach(push);
    return roles;
  }

  isAdminUser(user: any): boolean {
    return this.extractUserRoles(user).includes('admin');
  }

  /**
   * Ownership: Admin OR assignment.createdBy OR path owner (via lesson/module/path).
   */
  async assertCanManageAssignment(
    assignment: AssignmentEntity,
    currentUser: any,
  ): Promise<void> {
    if (!currentUser) throw new ForbiddenException('User session missing.');
    const roles = this.extractUserRoles(currentUser);
    if (roles.includes('admin') || roles.includes('trainer')) return;

    const userId = String(
      currentUser.id || currentUser.sub || '',
    ).toLowerCase();
    if (!userId) throw new ForbiddenException('User ID missing from token.');

    const creatorId = String(
      assignment.createdBy?.id || (assignment as any).createdById || '',
    ).toLowerCase();
    if (creatorId && creatorId === userId) return;

    // Path-linked: allow path owner
    const lessonId = assignment.lesson?.id;
    if (lessonId) {
      const isPathOwner = await this.checkIsTaskPathOwner(lessonId, userId);
      if (isPathOwner) return;
    }

    const pathId =
      assignment.learningPath?.id ||
      (assignment as any).learningPathId ||
      assignment.module?.learningPath?.id;
    if (pathId) {
      const path = await this.learningPathRepository.findOne({
        where: { id: pathId },
        relations: ['createdBy'],
      });
      const ownerId = String(
        path?.createdBy?.id || (path as any)?.createdById || '',
      ).toLowerCase();
      if (ownerId && ownerId === userId) return;
    }

    throw new ForbiddenException(
      'Access Denied: Only the creator or an Admin can edit or delete this assignment.',
    );
  }

  async checkIsTaskPathOwner(
    lessonId: string,
    userId: string,
  ): Promise<boolean> {
    if (!lessonId || !userId) return false;

    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: [
        'module',
        'module.learningPath',
        'module.learningPath.createdBy',
      ],
    });

    if (!lesson || !lesson.module || !lesson.module.learningPath) return false;

    const ownerId =
      lesson.module.learningPath.createdBy?.id ||
      (lesson.module.learningPath as any)?.createdById;
    if (!ownerId) return false;

    return String(ownerId).toLowerCase() === String(userId).toLowerCase();
  }



  async createAssignment(
    dto: any,
    creatorId: string,
  ): Promise<AssignmentEntity> {
    const {
      lessonId,
      moduleId,
      learningPathId,
      title,
      instructions,
      description,
      assignmentType,
      mcqConfig,
      maxScore,
      dueDate,
      externalUrl,
      traineeIds,
      assignedToTraineeIds,
      durationDays,
      durationHours,
      durationMinutes,
      anchorType,
      sequenceIndex,
    } = dto;

    if (!title || !title.trim()) {
      throw new BadRequestException('Assignment title is required.');
    }

    const external = isExternalAssignment({
      assignmentType,
      lessonId,
      moduleId,
      learningPathId,
    });

    if (!external) {
      if (!lessonId && !moduleId && !learningPathId) {
        throw new BadRequestException(
          'Provide lessonId, moduleId, or learningPathId — or set assignmentType to External.',
        );
      }
    }

    let calculatedMaxScore = maxScore || 100;
    if (assignmentType === 'MCQ' && mcqConfig?.questions?.length) {
      calculatedMaxScore = mcqConfig.questions.reduce(
        (sum: number, q: any) => sum + (Number(q.points) || 10),
        0,
      );
    } else if (mcqConfig?.questions?.length) {
      calculatedMaxScore = mcqConfig.questions.reduce(
        (sum: number, q: any) => sum + (Number(q.maxPoints || q.points) || 10),
        0,
      );
    }

    let lesson, module, learningPath;
    if (!external) {
      if (lessonId && UUID_REGEX.test(lessonId)) {
        lesson = await this.lessonRepository.findOne({
          where: { id: lessonId },
          relations: ['module', 'module.learningPath'],
        });
        if (lesson && !module && lesson.module) {
          module = lesson.module;
        }
        if (lesson && !learningPath && lesson.module?.learningPath) {
          learningPath = lesson.module.learningPath;
        }
      }
      if (moduleId && UUID_REGEX.test(moduleId)) {
        module = await this.moduleRepository.findOne({
          where: { id: moduleId },
          relations: ['learningPath'],
        });
        if (module && !learningPath && module.learningPath) {
          learningPath = module.learningPath;
        }
      }
      if (learningPathId && UUID_REGEX.test(learningPathId)) {
        learningPath = await this.learningPathRepository.findOne({
          where: { id: learningPathId },
          relations: ['modules', 'modules.lessons'],
        });
        if (!module && learningPath?.modules?.length) {
          if (dto.dependsOnLessonIds?.length) {
            const depSet = new Set(dto.dependsOnLessonIds.map(String));
            const matchingMod = learningPath.modules.find(m => (m.lessons || []).some(l => depSet.has(String(l.id))));
            if (matchingMod) module = matchingMod;
          }
          if (!module) {
            module = learningPath.modules[0];
          }
        }
      }
    }

    const assignedIds: string[] = Array.from(
      new Set(
        [
          ...(Array.isArray(traineeIds) ? traineeIds : []),
          ...(Array.isArray(assignedToTraineeIds) ? assignedToTraineeIds : []),
        ].filter((id) => typeof id === 'string' && UUID_REGEX.test(id)),
      ),
    );

    if (external && assignedIds.length === 0) {
      throw new BadRequestException(
        'External assignments require at least one trainee.',
      );
    }

    const assignment = this.repository.create({
      title,
      description: description || undefined,
      instructions: instructions || description || undefined,
      assignmentType: external ? 'External' : assignmentType || 'Subjective',
      externalUrl: externalUrl || undefined,
      mcqConfig: mcqConfig || undefined,
      maxScore: calculatedMaxScore,
      lesson: external ? undefined : lesson || undefined,
      module: external ? undefined : module || undefined,
      learningPath: external ? undefined : learningPath || undefined,
      createdBy: { id: creatorId },
      assignedToTraineeIds: assignedIds,
      durationDays: durationDays || 0,
      durationHours: durationHours || 0,
      durationMinutes: durationMinutes || 0,
      anchorType: anchorType || 'LP_ASSIGNED',
      sequenceIndex: sequenceIndex || null,
      isExternal: external,
    });

    const saved = await this.repository.save(assignment);

    if (assignedIds.length > 0) {
      const mappings = assignedIds.map(tid => this.traineeAssignmentRepository.create({
        assignment: { id: saved.id } as any,
        trainee: { id: tid } as any,
        assignedBy: { id: creatorId } as any,
      }));
      await this.traineeAssignmentRepository.save(mappings);
      
      const now = new Date();
      let computedDeadline: Date | null = null;
      let lpAssignedAt: Date | null = now;
      let taskUnlockedAt: Date | null = null;
      let initialStatus = external ? 'AVAILABLE' : 'LOCKED';

      if (anchorType === 'TASK_UNLOCKED' || anchorType === 'MODULE_UNLOCK') {
        lpAssignedAt = null;
        taskUnlockedAt = null; // Stays null until unlocked
      } else if (anchorType === 'TASK_START') {
        // Deadline is computed later when task starts
        computedDeadline = null;
      } else {
        // LP_ASSIGNED or ASSIGNMENT
        if ((durationDays || 0) > 0 || (durationHours || 0) > 0 || (durationMinutes || 0) > 0) {
           computedDeadline = new Date(now.getTime());
           if (durationDays) computedDeadline.setDate(computedDeadline.getDate() + durationDays);
           if (durationHours) computedDeadline.setHours(computedDeadline.getHours() + durationHours);
           if (durationMinutes) computedDeadline.setMinutes(computedDeadline.getMinutes() + durationMinutes);
        }
      }

      const submissions = assignedIds.map(tid => this.submissionRepository.create({
        assignment: { id: saved.id } as any,
        trainee: { id: tid } as any,
        status: initialStatus,
        lpAssignedAt: lpAssignedAt,
        deadline: computedDeadline,
        taskUnlockedAt: taskUnlockedAt
      }));
      await this.submissionRepository.save(submissions);
    }

    if (this.notificationService && assignedIds.length > 0) {
      await this.notificationService.createMany(
        assignedIds.map((traineeId) => ({
          userId: traineeId,
          type: 'assignment_assigned' as const,
          title: external ? 'New external assignment' : 'New assignment',
          message: `"${saved.title}" has been assigned to you.`,
          link: '/assignments',
          relatedEntityType: 'assignment',
          relatedEntityId: saved.id,
        })),
      );
    }

    return saved;
  }

  async assignToTrainees(
    assignmentId: string,
    traineeIds: string[],
    assignedById?: string,
  ): Promise<AssignmentEntity> {
    const assignment = await this.findOne(assignmentId);
    const ids = (traineeIds || []).filter((id) => UUID_REGEX.test(id));
    if (!ids.length)
      throw new BadRequestException('At least one traineeId is required.');

    const existing = assignment.assignedToTraineeIds || [];
    const merged = Array.from(new Set([...existing, ...ids]));
    const newlyAdded = ids.filter((id) => !existing.includes(id));

    assignment.assignedToTraineeIds = merged;
    const saved = await this.repository.save(assignment);

    // Save to mapping table
    if (newlyAdded.length > 0) {
      const mappings = newlyAdded.map(tid => this.traineeAssignmentRepository.create({
        assignment: { id: assignmentId } as any,
        trainee: { id: tid } as any,
        assignedBy: assignedById ? { id: assignedById } as any : null,
      }));
      await this.traineeAssignmentRepository.save(mappings);
    }

    if (this.notificationService && newlyAdded.length > 0) {
      await this.notificationService.createMany(
        newlyAdded.map((traineeId) => ({
          userId: traineeId,
          type: 'assignment_assigned' as const,
          title: 'New assignment',
          message: `"${saved.title}" has been assigned to you.`,
          link: '/assignments',
          relatedEntityType: 'assignment',
          relatedEntityId: saved.id,
        })),
      );
    }

    return saved;
  }

  async unassignTrainees(
    assignmentId: string,
    traineeIds: string[],
    unassignedById?: string,
  ): Promise<AssignmentEntity> {
    const assignment = await this.findOne(assignmentId);
    const ids = (traineeIds || []).filter((id) => UUID_REGEX.test(id));
    if (!ids.length)
      throw new BadRequestException('At least one traineeId is required.');

    const existing = assignment.assignedToTraineeIds || [];
    const removedIds = ids.filter((id: string) => existing.includes(id));
    assignment.assignedToTraineeIds = existing.filter((id: string) => !ids.includes(id));
    
    const saved = await this.repository.save(assignment);

    if (removedIds.length > 0) {
      for (const tid of removedIds) {
        await this.traineeAssignmentRepository.delete({
          assignment: { id: assignmentId },
          trainee: { id: tid }
        });
      }
    }

    return saved;
  }

  async updateAssignment(id: string, dto: any): Promise<AssignmentEntity> {
    const assignment = await this.findOne(id);

    if (dto.assignmentType === 'MCQ' && dto.mcqConfig?.questions?.length) {
      dto.maxScore = dto.mcqConfig.questions.reduce(
        (sum: number, q: any) => sum + (Number(q.points) || 10),
        0,
      );
    } else if (dto.mcqConfig?.questions?.length) {
      dto.maxScore = dto.mcqConfig.questions.reduce(
        (sum: number, q: any) => sum + (Number(q.maxPoints || q.points) || 10),
        0,
      );
    }

    if (dto.dueDate) dto.dueDate = new Date(dto.dueDate);

    // Do not allow re-attaching external to path via accidental empty clears in a bad way
    const {
      lessonId,
      moduleId,
      learningPathId,
      traineeIds,
      assignedToTraineeIds,
      anchorType,
      ...rest
    } = dto;
    const updated = this.repository.merge(assignment, rest);
    if (anchorType) {
      updated.anchorType = anchorType;
    }

    if (moduleId && UUID_REGEX.test(moduleId)) {
      const mod = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['learningPath'],
      });
      if (mod) {
        updated.module = mod;
        if (!updated.learningPath && mod.learningPath) {
          updated.learningPath = mod.learningPath;
        }
      }
    }
    if (lessonId && UUID_REGEX.test(lessonId)) {
      const les = await this.lessonRepository.findOne({
        where: { id: lessonId },
        relations: ['module', 'module.learningPath'],
      });
      if (les) {
        updated.lesson = les;
        if (les.module) updated.module = les.module;
        if (les.module?.learningPath) updated.learningPath = les.module.learningPath;
      }
    }
    if (learningPathId && UUID_REGEX.test(learningPathId)) {
      const lp = await this.learningPathRepository.findOne({
        where: { id: learningPathId },
        relations: ['modules', 'modules.lessons'],
      });
      if (lp) {
        updated.learningPath = lp;
        if (!updated.module && lp.modules?.length) {
          if (dto.dependsOnLessonIds?.length) {
            const depSet = new Set(dto.dependsOnLessonIds.map(String));
            const matchingMod = lp.modules.find(m => (m.lessons || []).some(l => depSet.has(String(l.id))));
            if (matchingMod) updated.module = matchingMod;
          }
          if (!updated.module) {
            updated.module = lp.modules[0];
          }
        }
      }
    }

    if (Array.isArray(traineeIds) || Array.isArray(assignedToTraineeIds)) {
      const ids = [
        ...(Array.isArray(traineeIds) ? traineeIds : []),
        ...(Array.isArray(assignedToTraineeIds)
          ? assignedToTraineeIds
          : assignment.assignedToTraineeIds || []),
      ].filter((id) => UUID_REGEX.test(id));
      updated.assignedToTraineeIds = Array.from(new Set(ids));
    }

    return await this.repository.save(updated);
  }

  async deleteAssignment(id: string): Promise<void> {
    const assignment = await this.findOne(id);
    await this.submissionRepository.delete({ assignment: { id } });
    await this.repository.remove(assignment);
  }

  async findOne(id: string, userId?: string): Promise<any> {
    const assignment = await this.repository.findOne({
      where: { id },
      relations: [
        'createdBy',
        'lesson',
        'lesson.module',
        'lesson.module.learningPath',
        'lesson.module.learningPath.createdBy',
        'module',
        'module.learningPath',
        'module.learningPath.createdBy',
        'learningPath',
        'learningPath.createdBy',
      ],
    });

    if (!assignment) {
      throw new NotFoundException(
        `Task / Assignment with ID "${id}" not found.`,
      );
    }

    const [assignmentWithLockState] = await this.attachLockStateToAssignments([assignment], userId);
    
    if (assignmentWithLockState.isLocked) {
      const { ForbiddenException } = require('@nestjs/common');
      throw new ForbiddenException(JSON.stringify({ 
        code: 'LOCKED_LESSONS_INCOMPLETE', 
        message: assignmentWithLockState.lockReason 
      }));
    }

    return assignmentWithLockState;
  }

  async evaluateSubmission(
    submissionId: string,
    evaluatorId: string,
    score: number,
    feedback: string,
    status: 'Approved' | 'Rejected' | 'Evaluated' = 'Approved',
    isAdmin: boolean = false,
  ): Promise<AssignmentSubmissionEntity> {
    if (status === 'Rejected' && (!feedback || !feedback.trim())) {
      throw new BadRequestException(
        'Feedback is mandatory when rejecting a submission.',
      );
    }

    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: [
        'trainee',
        'assignment',
        'assignment.createdBy',
        'assignment.lesson',
        'assignment.lesson.module',
        'assignment.lesson.module.learningPath',
        'assignment.module',
        'assignment.module.learningPath',
        'assignment.learningPath',
      ],
    });

    if (!submission)
      throw new NotFoundException(`Submission "${submissionId}" not found.`);

    if (!isAdmin && submission.trainee?.id && submission.assignment) {
      const assignment = submission.assignment;
      const assigner = await this.resolveAssignerForInstance(assignment, submission.trainee.id);
      let assignerId = assigner?.id || null;

      if (assignerId && String(assignerId).toLowerCase() !== String(evaluatorId).toLowerCase()) {
        throw new ForbiddenException('You are not authorized to evaluate this assignment because you did not assign it to this trainee.');
      }
    }

    submission.score = status === 'Rejected' ? 0 : score;
    submission.feedback = feedback;
    submission.status = status.toUpperCase() as any;
    submission.evaluatedAt = new Date();
    submission.evaluatedBy = { id: evaluatorId } as any;

    const saved = await this.submissionRepository.save(submission);

    // Mark trainer's pending-review notification for this submission as read
    if (this.notificationService) {
      await this.notificationService.markByRelatedEntity(
        evaluatorId,
        'submission',
        submissionId,
      );

      // Notify trainee of evaluation result
      if (submission.trainee?.id) {
        await this.notificationService.create({
          userId: submission.trainee.id,
          type: 'evaluation_completed',
          title:
            status === 'Rejected'
              ? 'Assignment needs improvement'
              : 'Assignment evaluated',
          message: `"${submission.assignment?.title || 'Assignment'}" was ${status.toLowerCase()}. Score: ${saved.score ?? 0}`,
          link: '/assignments',
          relatedEntityType: 'submission',
          relatedEntityId: submissionId,
        });
      }
    }

    return saved;
  }

  async findPendingSubmissionsForTrainer(
    trainerId?: string,
    filters?: { status?: string; type?: string }
  ): Promise<AssignmentSubmissionEntity[]> {
    const qb = this.submissionRepository.createQueryBuilder('submission')
      .leftJoinAndSelect('submission.trainee', 'trainee')
      .leftJoinAndSelect('submission.assignment', 'assignment')
      .leftJoinAndSelect('assignment.createdBy', 'assignmentCreatedBy')
      .leftJoinAndSelect('assignment.lesson', 'lesson')
      .leftJoinAndSelect('lesson.module', 'lessonModule')
      .leftJoinAndSelect('lessonModule.learningPath', 'lessonPath')
      .leftJoinAndSelect('lessonPath.createdBy', 'lessonPathCreator')
      .leftJoinAndSelect('assignment.module', 'module')
      .leftJoinAndSelect('module.learningPath', 'modulePath')
      .leftJoinAndSelect('assignment.learningPath', 'learningPath');

    // Default status filtering if none provided, or map the provided statuses
    if (filters?.status) {
      const statuses = filters.status.split(',').map(s => s.trim().toLowerCase());
      const orConditions = [];
      const params: any = {};
      
      if (statuses.includes('pending')) {
        orConditions.push("submission.status = 'SUBMITTED'");
      }
      if (statuses.includes('approved')) {
        orConditions.push("submission.status IN ('APPROVED', 'EVALUATED') AND (submission.score * 1.0 / assignment.max_score) >= 0.35");
      }
      if (statuses.includes('rejected')) {
        orConditions.push("submission.status = 'REJECTED'");
      }
      if (statuses.includes('needs improvement')) {
        orConditions.push("submission.status IN ('APPROVED', 'EVALUATED') AND (submission.score * 1.0 / assignment.max_score) < 0.35");
      }

      if (orConditions.length > 0) {
        qb.andWhere(`(${orConditions.join(' OR ')})`, params);
      } else {
        qb.andWhere("submission.status = 'SUBMITTED'");
      }
    } else {
      qb.andWhere("submission.status = 'SUBMITTED'");
    }

    if (filters?.type) {
      const types = filters.type.split(',').map(t => t.trim().toLowerCase());
      const orConditions = [];
      if (types.includes('learning path assignment')) {
        orConditions.push("(assignment.assignment_type != 'external' AND assignment.assignment_type != 'External')");
      }
      if (types.includes('external assignment')) {
        orConditions.push("(assignment.assignment_type = 'external' OR assignment.assignment_type = 'External')");
      }
      if (orConditions.length > 0) {
        qb.andWhere(`(${orConditions.join(' OR ')})`);
      }
    }

    qb.orderBy('submission.submittedAt', 'DESC');

    const all = await qb.getMany();

    // Filter submissions based on who assigned them (the assigner should evaluate)
    const filtered: AssignmentSubmissionEntity[] = [];
    for (const s of all) {
      if (!s.assignment || !s.trainee) continue;
      const assigner = await this.resolveAssignerForInstance(s.assignment, s.trainee.id);
      
      // Inject assignedBy dynamically into the payload for the frontend (vital for Admins)
      (s as any).assignedBy = assigner;

      if (!trainerId) {
        filtered.push(s);
      } else if (assigner && String(assigner.id).toLowerCase() === String(trainerId).toLowerCase()) {
        filtered.push(s);
      }
    }
    return filtered;
  }

  /**
   * Resolves who assigned a specific assignment instance to a specific trainee.
   */
  async resolveAssignerForInstance(
    assignment: AssignmentEntity,
    traineeId: string,
  ): Promise<any | null> {
    let assigner = null;

    const isExternal =
      String(assignment.assignmentType || '').toLowerCase() === 'external' ||
      (!assignment.lesson && !assignment.module && !assignment.learningPath);

    if (isExternal) {
      const mapping = await this.traineeAssignmentRepository.findOne({
        where: { assignment: { id: assignment.id }, trainee: { id: traineeId } },
        relations: ['assignedBy'],
        order: { assignedAt: 'DESC' },
      });
      if (mapping?.assignedBy) {
        assigner = mapping.assignedBy;
      }
    } else {
      let lpId = assignment.learningPath?.id || (assignment as any).learningPathId;
      if (!lpId && assignment.module?.learningPath) lpId = assignment.module.learningPath.id;
      if (!lpId && assignment.lesson?.module?.learningPath) lpId = assignment.lesson.module.learningPath.id;

      if (lpId) {
        const enrollment = await this.enrollmentRepository.findOne({
          where: { learningPath: { id: lpId }, user: { id: traineeId } },
          relations: ['assignedBy'],
        });
        if (enrollment?.assignedBy) {
          assigner = enrollment.assignedBy;
        }
      }
    }

    return assigner?.id ? assigner : null;
  }

  async submitAssignment(
    assignmentId: string,
    traineeId: string,
    submissionText: string,
    attachmentUrl?: string,
    answers?: Array<{ questionId: string; answer: string }>,
  ): Promise<AssignmentSubmissionEntity> {
    const assignment = await this.findOne(assignmentId, traineeId);
    // Check if overdue? Wait, due date check is removed.

    // External: only assigned trainees may submit
    const assigned = assignment.assignedToTraineeIds || [];
    if (
      String(assignment.assignmentType || '').toLowerCase() === 'external' &&
      assigned.length > 0 &&
      !assigned.includes(traineeId)
    ) {
      throw new ForbiddenException(
        'You are not assigned to this external assignment.',
      );
    }

    let submission = await this.submissionRepository.findOne({
      where: {
        assignment: { id: assignmentId },
        trainee: { id: traineeId },
      },
    });

    if (submission) {
      // B4: Idempotency guard — if already SUBMITTED within 10 seconds, treat as duplicate
      if (
        submission.status === 'SUBMITTED' &&
        submission.submittedAt &&
        Date.now() - new Date(submission.submittedAt).getTime() < 10_000
      ) {
        // Return the existing submission — double-click / network retry
        return submission;
      }

      if (submission.deadline && new Date() > new Date(submission.deadline)) {
        throw new BadRequestException('Task submission deadline has passed. This task is overdue.');
      }
      submission.submissionText = submissionText;
      submission.attachmentUrl = attachmentUrl || submission.attachmentUrl;
      submission.status = 'SUBMITTED';
      submission.submittedAt = new Date();
      if (answers) submission.answers = answers;
    } else {
      // B3: Compute total duration from real entity fields — assignment.durationValue does not exist
      const totalDurationMinutes =
        (assignment.durationDays || 0) * 24 * 60 +
        (assignment.durationHours || 0) * 60 +
        (assignment.durationMinutes || 0);
      if (totalDurationMinutes > 0) {
        throw new BadRequestException('You must start this task before submitting.');
      }
      submission = this.submissionRepository.create({
        assignment: { id: assignmentId },
        trainee: { id: traineeId },
        submissionText,
        attachmentUrl,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        answers: answers || undefined,
      });
    }

    const saved = await this.submissionRepository.save(submission);

    const assigner = await this.resolveAssignerForInstance(assignment, traineeId);
    let assignerId = assigner?.id || null;

    const trainee = await this.userRepository.findOne({ where: { id: traineeId } });
    const traineeName = trainee ? `${trainee.firstName || ''} ${trainee.lastName || ''}`.trim() || trainee.email : 'A trainee';

    // B1: Trigger AI evaluation using the NestJS-injected service (no more require())
    if (assignment.autoEvaluateWithAI && this.aiEvaluationService) {
      // Fire-and-forget — trainee gets immediate "Submitted" response, evaluation is async
      this.aiEvaluationService.evaluateSubmission(saved.id).catch((err: Error) => {
        console.error(`AI evaluation failed for submission ${saved.id}:`, err.message);
      });
    } else if (assignment.autoEvaluateWithAI && !this.aiEvaluationService) {
      // AI service not wired — fall through to manual notification and log warning
      console.warn(
        `[AssignmentService] autoEvaluateWithAI=true but AiEvaluationService not injected. ` +
        `Ensure AiEvaluationModule is imported into AssignmentModule. Falling back to manual eval.`,
      );
    }

    if (this.notificationService && assignerId && !assignment.autoEvaluateWithAI) {
      await this.notificationService.create({
        userId: assignerId,
        type: 'submission_pending',
        title: 'Submission ready for evaluation',
        message: `${traineeName} submitted "${assignment.title}" for review.`,
        link: '/evaluations',
        relatedEntityType: 'submission',
        relatedEntityId: saved.id,
      });
    }

    return saved;
  }

  async startAssignment(assignmentId: string, traineeId: string): Promise<AssignmentSubmissionEntity> {
    const assignment = await this.findOne(assignmentId, traineeId);

    if (assignment.isLocked) {
      throw new ForbiddenException('Cannot start a locked task.');
    }

    let submission = await this.submissionRepository.findOne({
      where: {
        assignment: { id: assignmentId },
        trainee: { id: traineeId },
      },
    });

    if (submission && submission.timerStartedAt) {
      throw new BadRequestException('Task has already been started.');
    }

    const now = new Date();
    
    let computedDeadline: Date | null = null;
    const { durationDays, durationHours, durationMinutes } = assignment;
    if ((durationDays || 0) > 0 || (durationHours || 0) > 0 || (durationMinutes || 0) > 0) {
      computedDeadline = new Date(now.getTime());
      if (durationDays) computedDeadline.setDate(computedDeadline.getDate() + durationDays);
      if (durationHours) computedDeadline.setHours(computedDeadline.getHours() + durationHours);
      if (durationMinutes) computedDeadline.setMinutes(computedDeadline.getMinutes() + durationMinutes);
    }

    if (submission) {
      submission.timerStartedAt = now;
      if (computedDeadline) {
        submission.deadline = computedDeadline;
      }
      if (submission.status === 'AVAILABLE' || submission.status === 'LOCKED') {
        submission.status = 'IN_PROGRESS';
      }
      return await this.submissionRepository.save(submission);
    } else {
      submission = this.submissionRepository.create({
        assignment: { id: assignmentId } as any,
        trainee: { id: traineeId } as any,
        timerStartedAt: now,
        deadline: computedDeadline,
        status: 'IN_PROGRESS'
      });
      return await this.submissionRepository.save(submission);
    }
  }

  async restartAssignment(assignmentId: string, traineeId: string): Promise<AssignmentSubmissionEntity> {
    const assignment = await this.findOne(assignmentId, traineeId);

    if (assignment.isLocked) {
      throw new ForbiddenException('Cannot restart a locked task.');
    }

    // B3: durationValue does not exist — compute from the three real duration fields
    const totalDurationMinutes =
      (assignment.durationDays || 0) * 24 * 60 +
      (assignment.durationHours || 0) * 60 +
      (assignment.durationMinutes || 0);
    if (totalDurationMinutes <= 0) {
      throw new BadRequestException('This task does not have a duration set, restart not required.');
    }

    const submission = await this.submissionRepository.findOne({
      where: {
        assignment: { id: assignmentId },
        trainee: { id: traineeId },
      },
    });

    if (!submission) {
      throw new BadRequestException('Task has not been started yet.');
    }

    const now = new Date();
    submission.timerStartedAt = now;
    submission.status = 'IN_PROGRESS';
    submission.submissionText = undefined as any;
    submission.attachmentUrl = undefined as any;
    submission.submittedAt = undefined as any;

    return await this.submissionRepository.save(submission);
  }


  async attachLockStateToAssignments(assignments: AssignmentEntity[], userId?: string): Promise<any[]> {
    if (!userId || assignments.length === 0) {
      return assignments.map(a => ({ ...a, isLocked: false, lockReason: null }));
    }

    const assignmentsByModuleId = new Map<string, AssignmentEntity[]>();
    for (const assignment of assignments) {
      const modId = assignment.module?.id || assignment.lesson?.module?.id;
      if (modId) {
        if (!assignmentsByModuleId.has(modId)) assignmentsByModuleId.set(modId, []);
        assignmentsByModuleId.get(modId)!.push(assignment);
      }
    }

    const moduleIds = Array.from(assignmentsByModuleId.keys());
    if (moduleIds.length === 0) {
      return assignments.map(a => ({ ...a, isLocked: false, lockReason: null }));
    }

    // Fetch modules to check taskLocking toggle on parent learning path
    const modules = await this.moduleRepository.find({
      where: { id: In(moduleIds) },
      relations: ['learningPath']
    });
    const moduleMap = new Map(modules.map(m => [m.id, m]));

    // Fetch user progress for these modules
    const userProgress = await this.datasource.getRepository('UserLessonProgressEntity').find({
      where: moduleIds.map(id => ({
        user: { id: userId },
        lesson: { module: { id } },
        isCompleted: true
      })),
      relations: ['lesson']
    });

    const completedLessonIds = new Set(userProgress.map((p: any) => p.lesson?.id));

    const result = [];
    for (const assignment of assignments) {
      const modId = assignment.module?.id || assignment.lesson?.module?.id;
      const mod = modId ? moduleMap.get(modId) : null;
      const lp = mod?.learningPath;

      // B2: Three independent lock layers (any one can lock the assignment):
      // Layer 1 — LP-level global lock (lockTasks)
      const lpLockEnabled = lp ? (lp.lockTasks !== false) : false;
      // Layer 2 — Module-level lock (taskLocking)
      const modLockEnabled = mod ? (mod.taskLocking === true) : false;
      // Layer 3 — Per-assignment lock (lockUntilLessonsComplete)
      const assignmentLockEnabled = (assignment as any).lockUntilLessonsComplete === true;

      // If none of the three lock layers are active, assignment is always unlocked
      const anyLockEnabled = lpLockEnabled || modLockEnabled || assignmentLockEnabled;
      if (!anyLockEnabled) {
        result.push({ ...assignment, isLocked: false, lockReason: null });
        continue;
      }

      // B2: Use dependsOnLessonIds for precise dependency checking when per-assignment lock is active.
      // Fall back to all module lessons when LP/module-level lock is the reason.
      let lessonIdsToCheck: string[];
      const depLessonIds: string[] = (assignment as any).dependsOnLessonIds || [];

      if (assignmentLockEnabled && depLessonIds.length > 0) {
        // Precise: only require the specific dependent lessons to be complete
        lessonIdsToCheck = depLessonIds;
      } else if ((lpLockEnabled || modLockEnabled) && mod) {
        // Coarse: require all lessons in the module to be complete
        const siblingLessons = await this.lessonRepository.find({
          where: { module: { id: mod.id } },
          select: ['id'],
        });
        lessonIdsToCheck = siblingLessons.map(l => l.id);
      } else {
        // No lessons to check (e.g. assignment lock enabled but no deps yet) — treat as unlocked
        result.push({ ...assignment, isLocked: false, lockReason: null });
        continue;
      }

      const hasIncomplete = lessonIdsToCheck.some(id => !completedLessonIds.has(id));
      if (hasIncomplete) {
        result.push({
          ...assignment,
          isLocked: true,
          lockReason: assignmentLockEnabled && depLessonIds.length > 0
            ? `Complete the required lessons to unlock this assignment.`
            : `Complete all lessons in this module to unlock tasks.`,
        });
      } else {
        result.push({ ...assignment, isLocked: false, lockReason: null });
      }
    }
    return result;
  }

  async getAllAssignmentsEnriched(currentUser?: any): Promise<AssignmentEntity[]> {
    const assignments = await this.repository.find({
      relations: [
        'lesson',
        'lesson.module',
        'lesson.module.learningPath',
        'module',
        'module.learningPath',
        'learningPath',
        'createdBy',
      ],
      order: { createdAt: 'DESC' },
    });
    const enriched = await this.enrichAssignmentsWithStatus(assignments, currentUser);
    return await this.attachLockStateToAssignments(enriched, currentUser?.id || currentUser?.sub);
  }

  async findAll(
    currentUser?: any, 
    filters?: { status?: string; type?: string; difficulty?: string; lockState?: string }
  ): Promise<AssignmentEntity[]> {
    const enriched = await this.getAllAssignmentsEnriched(currentUser);
    
    if (!currentUser) return enriched;

    const isAdmin = this.isAdminUser(currentUser);
    let result = enriched;

    if (!isAdmin) {
      const roles = this.extractUserRoles(currentUser);
      const isTrainer = roles.includes('trainer');
      const isTrainee = roles.includes('trainee');
      const userId = currentUser?.id || currentUser?.sub;

      if (isTrainer) {
        result = enriched.filter((a: any) => {
          return a.submissions && a.submissions.length > 0;
        });
      } else if (isTrainee) {
        return await this.findMyAssignments(userId, currentUser, filters);
      }
    }

    if (filters && !this.extractUserRoles(currentUser).includes('trainee')) {
      if (filters.type) {
        const types = filters.type.split(',').map(t => t.trim().toLowerCase());
        result = result.filter(a => {
          const isExt = String(a.assignmentType || '').toLowerCase() === 'external';
          if (types.includes('external') && isExt) return true;
          if (types.includes('learning path') && !isExt) return true;
          return false;
        });
      }
      
      if (filters.difficulty) {
        const diffs = filters.difficulty.split(',').map(d => d.trim().toLowerCase());
        result = result.filter(a => diffs.includes(String(a.difficultyLevel || '').toLowerCase()));
      }

      if (filters.status) {
        const statuses = filters.status.split(',').map(s => s.trim().toLowerCase());
        result = result.filter(a => {
          const aStatus = String((a as any).status || '').toLowerCase();
          
          if (statuses.includes(aStatus)) return true;
          
          if (statuses.includes('in progress') && (aStatus === 'started' || aStatus === 'in progress')) {
            return true;
          }

          if (statuses.includes('needs improvement') || statuses.includes('approved but score < 35%')) {
            if (aStatus === 'rejected') return true;
            if (aStatus === 'approved' || aStatus === 'evaluated') {
               const score = (a as any).score || 0;
               const max = a.maxScore || 100;
               if ((score / max) < 0.35) return true;
            }
          }

          if (statuses.includes('approved')) {
            if (aStatus === 'approved' || aStatus === 'evaluated') {
               // Usually approved means >= 35% if we want strict categories, 
               // but we can just return true if it is evaluated.
               return true;
            }
          }

          return false;
        });
      }
    }

    return result;
  }

  /**
   * Derive Pending / In Progress / Submitted / Accepted / Rejected from submissions.
   */
  async enrichAssignmentsWithStatus(
    assignments: AssignmentEntity[],
    currentUser?: any,
  ): Promise<any[]> {
    if (!assignments.length) return [];
    
    const roles = this.extractUserRoles(currentUser);
    
    const isTrainer = !this.isAdminUser(currentUser) && roles.includes('trainer');
    const isTrainee = !this.isAdminUser(currentUser) && roles.includes('trainee');
    const userId = currentUser?.id || currentUser?.sub;

    const ids = new Set(assignments.map((a) => a.id));
    const allSubs = await this.submissionRepository.find({
      relations: ['trainee', 'assignment', 'evaluatedBy'],
      order: { submittedAt: 'DESC' } as any,
    });

    const byAssignment = new Map<string, AssignmentSubmissionEntity[]>();
    for (const s of allSubs) {
      const aid = s.assignment?.id || (s.assignment as any)?.id;
      if (!aid || !ids.has(aid)) continue;

      // Replace s.assignment with the fully populated one from our array
      const populatedAssignment = assignments.find(a => a.id === aid);
      if (populatedAssignment) {
        s.assignment = populatedAssignment;
      }

      let includeSub = true;

      if (s.assignment && s.trainee) {
        const assigner = await this.resolveAssignerForInstance(s.assignment, s.trainee.id);
        (s as any).assignedBy = assigner;

        if (isTrainer) {
          const isAssigner = assigner && String(assigner.id).toLowerCase() === String(userId).toLowerCase();
          const isEvaluator = s.evaluatedBy && String(s.evaluatedBy.id).toLowerCase() === String(userId).toLowerCase();
          if (!isAssigner && !isEvaluator) {
            includeSub = false;
          }
          // Trainer only sees submissions that have actually been submitted (not just started)
          if (s.status === 'IN_PROGRESS' || s.status === 'AVAILABLE' || s.status === 'LOCKED') {
            includeSub = false;
          }
        }
      }

      if (isTrainee) {
        if (!s.trainee || String(s.trainee.id).toLowerCase() !== String(userId).toLowerCase()) {
          includeSub = false;
        }
      }

      if (includeSub) {
        if (!byAssignment.has(aid)) byAssignment.set(aid, []);
        byAssignment.get(aid)!.push(s);
      }
    }

    return assignments.map((a) => {
      const subs = byAssignment.get(a.id) || [];
      let status = 'Pending';
      let score: number | null = null;
      const latestSubmission: AssignmentSubmissionEntity | null =
        subs[0] || null;

      if (subs.length === 0) {
        status = 'Pending';
      } else {
        const hasSubmitted = subs.some((s) => s.status === 'SUBMITTED');
        const hasAccepted = subs.some(
          (s) => s.status === 'APPROVED' || s.status === 'EVALUATED',
        );
        const hasRejected = subs.some((s) => s.status === 'REJECTED');
        if (hasSubmitted) status = 'Submitted';
        else if (hasAccepted) status = 'Approved';
        else if (hasRejected) status = 'Rejected';
        else {
          const hasStarted = subs.some((s) => s.status === 'IN_PROGRESS');
          status = hasStarted ? 'started' : 'In Progress';
          
          if (status === 'started') {
            const startedSub = subs.find((s) => s.status === 'IN_PROGRESS');
            if (startedSub?.deadline && new Date() > new Date(startedSub.deadline)) {
              status = 'Overdue';
            }
          }
        }

        const scored = subs.find((s) => typeof s.score === 'number');
        if (scored) score = scored.score;
      }

      return {
        ...a,
        status,
        score,
        startedAt: latestSubmission?.timerStartedAt || null,
        deadlineAt: latestSubmission?.deadline || null,
        maxScore: a.maxScore,
        submissions: subs,
        latestSubmission,
        traineeCount: (a.assignedToTraineeIds || []).length || subs.length,
      };
    });
  }

  async findExternalAssignments(currentUser?: any): Promise<AssignmentEntity[]> {
    const all = await this.findAll(currentUser);
    return all.filter(
      (a) =>
        String(a.assignmentType || '').toLowerCase() === 'external' ||
        (!a.lesson && !a.module && !a.learningPath),
    );
  }

  async findMyAssignments(
    traineeId: string, 
    currentUser?: any,
    filters?: { status?: string; type?: string; difficulty?: string; lockState?: string }
  ): Promise<AssignmentEntity[]> {
    const userToPass = currentUser || { sub: traineeId, 'custom:role': '["trainee"]' };
    
    // We fetch assignments but we can pre-filter them if `type` or `difficulty` is provided
    let all = await this.getAllAssignmentsEnriched(userToPass);

    const enrolledPaths = await this.enrollmentRepository.find({
      where: { user: { id: traineeId }, status: 'active' },
      relations: ['learningPath']
    });
    const enrolledPathIds = new Set(enrolledPaths.map((e) => e.learningPath?.id).filter(Boolean));

    const directMappings = await this.traineeAssignmentRepository.find({
      where: { trainee: { id: traineeId } },
      relations: ['assignment']
    });
    const directAssignedIds = new Set(directMappings.map((m) => m.assignment?.id).filter(Boolean));

    const filtered = all.filter((a) => {
      const isExternal =
        String(a.assignmentType || '').toLowerCase() === 'external' ||
        (!a.lesson && !a.module && !a.learningPath);

      if (isExternal) {
        const assignedDirectFallback = (a.assignedToTraineeIds || []).includes(traineeId);
        return assignedDirectFallback || directAssignedIds.has(a.id);
      }

      const pathId =
        a.learningPath?.id ||
        (a as any).learningPathId ||
        a.module?.learningPath?.id ||
        a.lesson?.module?.learningPath?.id;
      return pathId && enrolledPathIds.has(pathId);
    });

    let result = filtered;

    // Apply Filters
    if (filters) {
      if (filters.type) {
        const types = filters.type.split(',').map(t => t.trim().toLowerCase());
        result = result.filter(a => {
          const isExt = String(a.assignmentType || '').toLowerCase() === 'external';
          if (types.includes('external') && isExt) return true;
          if (types.includes('learning path') && !isExt) return true;
          return false;
        });
      }
      
      if (filters.difficulty) {
        const diffs = filters.difficulty.split(',').map(d => d.trim().toLowerCase());
        result = result.filter(a => diffs.includes(String(a.difficultyLevel || '').toLowerCase()));
      }

      if (filters.lockState) {
        const locks = filters.lockState.split(',').map(l => l.trim().toLowerCase());
        result = result.filter(a => {
          if (locks.includes('locked') && (a as any).isLocked) return true;
          if (locks.includes('unlocked') && !(a as any).isLocked) return true;
          return false;
        });
      }

      if (filters.status) {
        const statuses = filters.status.split(',').map(s => s.trim().toLowerCase());
        result = result.filter(a => {
          const aStatus = String((a as any).status || '').toLowerCase();
          
          if (statuses.includes(aStatus)) {
            return true;
          }

          if (statuses.includes('in progress') && (aStatus === 'started' || aStatus === 'in progress')) {
            return true;
          }
          
          if (statuses.includes('approved but score < 35%') || statuses.includes('needs improvement')) {
            if (aStatus === 'rejected') return true;
            if (aStatus === 'approved' || aStatus === 'evaluated') {
               const score = (a as any).score || 0;
               const max = a.maxScore || 100;
               if ((score / max) < 0.35) return true;
            }
          }

          if (statuses.includes('approved')) {
            if (aStatus === 'approved' || aStatus === 'evaluated') return true;
          }

          return false;
        });
      }
    }

    for (const a of result) {
      const assigner = await this.resolveAssignerForInstance(a, traineeId);
      if (assigner) {
        (a as any).assignedBy = assigner;
      }
    }

    return result.sort((a, b) => {
      const aSub = (a as any).latestSubmission;
      const bSub = (b as any).latestSubmission;
      const aStatus = aSub?.status || 'not_started';
      const bStatus = bSub?.status || 'not_started';
      const aLocked = aStatus.toLowerCase() === 'locked';
      const bLocked = bStatus.toLowerCase() === 'locked';

      if (aLocked && !bLocked) return 1;
      if (!aLocked && bLocked) return -1;

      const aDeadline = aSub?.deadline ? new Date(aSub.deadline).getTime() : Infinity;
      const bDeadline = bSub?.deadline ? new Date(bSub.deadline).getTime() : Infinity;
      
      return aDeadline - bDeadline;
    });
  }

  async findByLessonId(lessonId: string, currentUser?: any): Promise<AssignmentEntity[]> {
    const assignments = await this.repository.find({
      where: { lesson: { id: lessonId } },
      relations: ['createdBy', 'lesson', 'module'],
    });
    return await this.enrichAssignmentsWithStatus(assignments, currentUser);
  }

  async findTraineeSubmission(assignmentId: string, traineeId: string) {
    return await this.submissionRepository.findOne({
      where: {
        assignment: { id: assignmentId },
        trainee: { id: traineeId },
      },
    });
  }

  async findSubmissionsByAssignment(assignmentId: string) {
    return await this.submissionRepository.find({
      where: { assignment: { id: assignmentId } },
      relations: ['trainee'],
    });
  }

  async findMySubmissions(
    traineeId: string,
  ): Promise<AssignmentSubmissionEntity[]> {
    if (!traineeId) {
      throw new BadRequestException('Trainee ID is required.');
    }

    return await this.submissionRepository.find({
      where: {
        trainee: { id: traineeId },
      },
      relations: [
        'assignment',
        'assignment.lesson',
        'assignment.module',
        'assignment.learningPath',
        'assignment.createdBy',
        'evaluatedBy',
      ],
      order: {
        submittedAt: 'DESC',
      } as any,
    });
  }

  async getSubmissionById(id: string): Promise<AssignmentSubmissionEntity> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ['assignment', 'trainee', 'assignment.createdBy', 'evaluatedBy'],
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    return submission;
  }

  async evaluateLockState(assignment: AssignmentEntity, userId: string): Promise<{ isLocked: boolean; lockReason: string | null }> {
    if (!userId || !assignment) return { isLocked: false, lockReason: null };
    try {
      const completedProgress = await this.userLessonProgressRepo.find({
        where: { user: { id: userId }, isCompleted: true },
        relations: ['lesson'],
      });
      const completedLessonIds = completedProgress.map(p => p.lesson?.id).filter(Boolean) as string[];
      const unlocked = isAssignmentUnlocked(assignment as any, { completedLessonIds });
      if (!unlocked) {
        return { isLocked: true, lockReason: 'Complete required preceding lessons to unlock this task.' };
      }
      return { isLocked: false, lockReason: null };
    } catch {
      return { isLocked: false, lockReason: null };
    }
  }

  async getQuestionLessonOptions(assignmentId: string, questionId: string) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    const poolIds = assignment.dependsOnLessonIds || [];
    
    let assignmentLessonPool = [];
    if (poolIds.length > 0) {
      const lessons = await this.datasource.query(`SELECT id, title FROM "Lesson" WHERE id = ANY($1)`, [poolIds]);
      assignmentLessonPool = lessons.map((l: any) => ({ lessonId: l.id, title: l.title }));
    }
    
    const currentDeps = await this.questionLessonDepRepository.find({ where: { questionId }, relations: ['lesson'] });
    return {
      assignmentLessonPool,
      currentDependencies: currentDeps.map((d: any) => d.lesson?.id),
    };
  }

  async setQuestionLessonDependencies(assignmentId: string, questionId: string, lessonIds: string[], requiresLessonGrounding: boolean) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    
    // Subset constraint validation
    const pool = new Set(assignment.dependsOnLessonIds || []);
    const invalid = lessonIds.filter(id => !pool.has(id));
    if (invalid.length > 0) {
      throw new Error(`INVALID_LESSON_DEPENDENCY: Question can only depend on lessons already in its assignment's pool. Invalid: ${invalid.join(', ')}`);
    }

    // Update questions JSON
    if (assignment.questions) {
      const qIdx = assignment.questions.findIndex((q: any) => q.id === questionId);
      if (qIdx >= 0) {
        assignment.questions[qIdx].requiresLessonGrounding = requiresLessonGrounding;
        await this.repository.save(assignment);
      }
    }

    await this.questionLessonDepRepository.delete({ questionId });
    const depsToSave = lessonIds.map(id => this.questionLessonDepRepository.create({
      questionId,
      lesson: { id } as any,
      source: 'creator'
    }));
    if (depsToSave.length > 0) {
      await this.questionLessonDepRepository.save(depsToSave);
    }
    
    return { questionId, lessonIds, source: 'creator', requiresLessonGrounding };
  }

  async getQuestionsWithDependencies(assignmentId: string) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    
    const questions = assignment.questions || [];
    const deps = await this.questionLessonDepRepository.find({
      where: { questionId: In(questions.map((q: any) => q.id)) },
      relations: ['lesson']
    });
    
    const depMap = deps.reduce((acc, d) => {
      if (!acc[d.questionId]) acc[d.questionId] = [];
      acc[d.questionId].push({ lessonId: (d.lesson as any)?.id, source: d.source });
      return acc;
    }, {} as Record<string, any[]>);

    return {
      questions: questions.map((q: any) => ({
        questionId: q.id,
        text: q.text,
        lessonDependencies: depMap[q.id] || [],
        requiresLessonGrounding: q.requiresLessonGrounding !== false
      }))
    };
  }

  async validateAssignmentBeforePublish(assignmentId: string) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    
    const pool = new Set(assignment.dependsOnLessonIds || []);
    const questions = assignment.questions || [];
    const deps = await this.questionLessonDepRepository.find({
      where: { questionId: In(questions.map((q: any) => q.id)) },
      relations: ['lesson']
    });
    
    const depMap = deps.reduce((acc, d) => {
      if (!acc[d.questionId]) acc[d.questionId] = [];
      acc[d.questionId].push((d.lesson as any)?.id);
      return acc;
    }, {} as Record<string, string[]>);
    
    const errors = [];
    for (const question of questions) {
      const qDeps = depMap[question.id] || [];
      const hasDependency = qDeps.length > 0;
      const orphaned = qDeps.filter(id => !pool.has(id));
      
      const requiresGrounding = question.requiresLessonGrounding !== false;
      
      if (!hasDependency && requiresGrounding) {
        errors.push({
          questionId: question.id,
          type: 'MISSING_DEPENDENCY',
          message: `Question "${(question.text || '').slice(0, 40)}..." has no lesson dependency set. Select at least one lesson from this assignment's pool, or mark it as not requiring lesson grounding.`
        });
      }
      if (orphaned.length > 0) {
        errors.push({
          questionId: question.id,
          type: 'ORPHANED_DEPENDENCY',
          message: `Question depends on lesson(s) no longer in this assignment's pool: ${orphaned.join(', ')}. Update its dependency.`,
          invalidLessonIds: orphaned
        });
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  async getMigrationReviewQueue(assignmentId: string) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    
    const questions = assignment.questions || [];
    const deps = await this.questionLessonDepRepository.find({
      where: { questionId: In(questions.map((q: any) => q.id)), source: 'backfill' },
      relations: ['lesson']
    });
    
    const questionsNeedingReview = new Set(deps.map(d => d.questionId));
    
    const depMap = deps.reduce((acc, d) => {
      if (!acc[d.questionId]) acc[d.questionId] = [];
      acc[d.questionId].push((d.lesson as any)?.id);
      return acc;
    }, {} as Record<string, string[]>);
    
    const pendingReview = [];
    for (const qId of questionsNeedingReview) {
      const q = questions.find((q: any) => q.id === qId);
      if (q) {
        pendingReview.push({
          questionId: q.id,
          text: q.text,
          backfilledLessonIds: depMap[q.id] || []
        });
      }
    }
    
    return {
      pendingReview,
      totalPending: pendingReview.length,
      totalQuestions: questions.length
    };
  }

}

