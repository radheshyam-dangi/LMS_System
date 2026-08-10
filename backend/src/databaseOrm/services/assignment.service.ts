import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { AssignmentEntity } from '../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../entities/assignmentSubmission.entity';
import { LessonEntity } from '../entities/lesson.entity';
import { ModuleEntity } from '../entities/module.entity';
import { LearningPathEntity } from '../entities/learningPath.entity';
import { NotificationService } from '../modules/notification/notification.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const hasPath = !!(dtoOrEntity.learningPathId || dtoOrEntity.learningPath?.id);
  return !hasLesson && !hasModule && !hasPath;
}

@Injectable()
export class AssignmentEntityService extends BaseService<AssignmentEntity> {
  protected repository: Repository<AssignmentEntity>;
  private submissionRepository: Repository<AssignmentSubmissionEntity>;
  private lessonRepository: Repository<LessonEntity>;
  private moduleRepository: Repository<ModuleEntity>;
  private learningPathRepository: Repository<LearningPathEntity>;

  constructor(
    private readonly datasource: DataSource,
    @Optional()
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService?: NotificationService,
  ) {
    super();
    this.repository = this.datasource.getRepository<AssignmentEntity>(AssignmentEntity);
    this.submissionRepository = this.datasource.getRepository<AssignmentSubmissionEntity>(AssignmentSubmissionEntity);
    this.lessonRepository = this.datasource.getRepository<LessonEntity>(LessonEntity);
    this.moduleRepository = this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.learningPathRepository = this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
  }

  private extractUserRoles(user: any): string[] {
    const roles: string[] = [];
    const push = (v: any) => {
      if (!v) return;
      if (typeof v === 'string') roles.push(v.toLowerCase());
      else if (v?.name) roles.push(String(v.name).toLowerCase());
    };
    push(user?.role);
    push(user?.primaryRole);
    push(user?.activeRole);
    if (Array.isArray(user?.roles)) user.roles.forEach(push);
    return roles;
  }

  isAdminUser(user: any): boolean {
    return this.extractUserRoles(user).includes('admin');
  }

  /**
   * Ownership: Admin OR assignment.createdBy OR path owner (via lesson/module/path).
   */
  async assertCanManageAssignment(assignment: AssignmentEntity, currentUser: any): Promise<void> {
    if (!currentUser) throw new ForbiddenException('User session missing.');
    const roles = this.extractUserRoles(currentUser);
    if (roles.includes('admin') || roles.includes('trainer')) return;

    const userId = String(currentUser.id || currentUser.sub || '').toLowerCase();
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
      const ownerId = String(path?.createdBy?.id || (path as any)?.createdById || '').toLowerCase();
      if (ownerId && ownerId === userId) return;
    }

    throw new ForbiddenException(
      'Access Denied: Only the creator or an Admin can edit or delete this assignment.',
    );
  }

  async checkIsTaskPathOwner(lessonId: string, userId: string): Promise<boolean> {
    if (!lessonId || !userId) return false;

    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: ['module', 'module.learningPath', 'module.learningPath.createdBy'],
    });

    if (!lesson || !lesson.module || !lesson.module.learningPath) return false;

    const ownerId = lesson.module.learningPath.createdBy?.id || (lesson.module.learningPath as any)?.createdById;
    if (!ownerId) return false;

    return String(ownerId).toLowerCase() === String(userId).toLowerCase();
  }

  async createAssignment(dto: any, creatorId: string): Promise<AssignmentEntity> {
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
        lesson = await this.lessonRepository.findOne({ where: { id: lessonId } });
      }
      if (moduleId && UUID_REGEX.test(moduleId)) {
        module = await this.moduleRepository.findOne({ where: { id: moduleId } });
      }
      if (learningPathId && UUID_REGEX.test(learningPathId)) {
        learningPath = await this.learningPathRepository.findOne({ where: { id: learningPathId } });
      }
    }

    const assignedIds: string[] = Array.from(
      new Set(
        [...(Array.isArray(traineeIds) ? traineeIds : []), ...(Array.isArray(assignedToTraineeIds) ? assignedToTraineeIds : [])]
          .filter((id) => typeof id === 'string' && UUID_REGEX.test(id)),
      ),
    );

    if (external && assignedIds.length === 0) {
      throw new BadRequestException('External assignments require at least one trainee.');
    }

    const assignment = this.repository.create({
      title,
      description: description || undefined,
      instructions: instructions || description || undefined,
      assignmentType: external ? 'External' : assignmentType || 'Subjective',
      externalUrl: externalUrl || undefined,
      mcqConfig: mcqConfig || undefined,
      maxScore: calculatedMaxScore,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      lesson: external ? undefined : lesson || undefined,
      module: external ? undefined : module || undefined,
      learningPath: external ? undefined : learningPath || undefined,
      createdBy: { id: creatorId } as any,
      assignedToTraineeIds: assignedIds,
    });

    const saved = await this.repository.save(assignment);

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

  async assignToTrainees(assignmentId: string, traineeIds: string[]): Promise<AssignmentEntity> {
    const assignment = await this.findOne(assignmentId);
    const ids = (traineeIds || []).filter((id) => UUID_REGEX.test(id));
    if (!ids.length) throw new BadRequestException('At least one traineeId is required.');

    const existing = assignment.assignedToTraineeIds || [];
    const merged = Array.from(new Set([...existing, ...ids]));
    const newlyAdded = ids.filter((id) => !existing.includes(id));

    assignment.assignedToTraineeIds = merged;
    const saved = await this.repository.save(assignment);

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
    const { lessonId, moduleId, learningPathId, traineeIds, assignedToTraineeIds, ...rest } = dto;
    const updated = this.repository.merge(assignment, rest);

    if (Array.isArray(traineeIds) || Array.isArray(assignedToTraineeIds)) {
      const ids = [
        ...(Array.isArray(traineeIds) ? traineeIds : []),
        ...(Array.isArray(assignedToTraineeIds) ? assignedToTraineeIds : assignment.assignedToTraineeIds || []),
      ].filter((id) => UUID_REGEX.test(id));
      updated.assignedToTraineeIds = Array.from(new Set(ids));
    }

    return await this.repository.save(updated);
  }

  async deleteAssignment(id: string): Promise<void> {
    const assignment = await this.findOne(id);
    await this.submissionRepository.delete({ assignment: { id } } as any);
    await this.repository.remove(assignment);
  }

  async findOne(id: string): Promise<AssignmentEntity> {
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
      throw new NotFoundException(`Task / Assignment with ID "${id}" not found.`);
    }

    return assignment;
  }

  async evaluateSubmission(
    submissionId: string,
    evaluatorId: string,
    score: number,
    feedback: string,
    status: 'Accepted' | 'Rejected' | 'Evaluated' = 'Accepted',
  ): Promise<AssignmentSubmissionEntity> {
    if (status === 'Rejected' && (!feedback || !feedback.trim())) {
      throw new BadRequestException('Feedback is mandatory when rejecting a submission.');
    }

    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId } as any,
      relations: [
        'trainee',
        'assignment',
        'assignment.createdBy',
        'assignment.lesson',
        'assignment.lesson.module',
        'assignment.lesson.module.learningPath',
      ],
    });

    if (!submission) throw new NotFoundException(`Submission "${submissionId}" not found.`);

    submission.score = status === 'Rejected' ? 0 : score;
    submission.feedback = feedback;
    submission.status = status;
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
          title: status === 'Rejected' ? 'Assignment needs improvement' : 'Assignment evaluated',
          message: `"${submission.assignment?.title || 'Assignment'}" was ${status.toLowerCase()}. Score: ${saved.score ?? 0}`,
          link: '/assignments',
          relatedEntityType: 'submission',
          relatedEntityId: submissionId,
        });
      }
    }

    return saved;
  }

  async findPendingSubmissionsForTrainer(trainerId?: string): Promise<AssignmentSubmissionEntity[]> {
    const all = await this.submissionRepository.find({
      where: { status: 'Submitted' } as any,
      relations: [
        'trainee',
        'assignment',
        'assignment.createdBy',
        'assignment.lesson',
        'assignment.lesson.module',
        'assignment.lesson.module.learningPath',
        'assignment.lesson.module.learningPath.createdBy',
        'assignment.module',
        'assignment.learningPath',
      ],
      order: { submittedAt: 'DESC' } as any,
    });

    if (!trainerId) return all;

    // Prefer submissions for assignments created by this trainer; admins still get all via controller
    return all.filter((s) => {
      const creatorId = s.assignment?.createdBy?.id || (s.assignment as any)?.createdById;
      return !creatorId || String(creatorId).toLowerCase() === String(trainerId).toLowerCase();
    });
  }

  async submitAssignment(
    assignmentId: string,
    traineeId: string,
    submissionText: string,
    attachmentUrl?: string,
  ): Promise<AssignmentSubmissionEntity> {
    const assignment = await this.repository.findOne({
      where: { id: assignmentId },
      relations: ['createdBy'],
    });
    if (!assignment) throw new NotFoundException(`Task "${assignmentId}" not found.`);

    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
      throw new BadRequestException('Task submission deadline has passed.');
    }

    // External: only assigned trainees may submit
    const assigned = assignment.assignedToTraineeIds || [];
    if (
      String(assignment.assignmentType || '').toLowerCase() === 'external' &&
      assigned.length > 0 &&
      !assigned.includes(traineeId)
    ) {
      throw new ForbiddenException('You are not assigned to this external assignment.');
    }

    let submission = await this.submissionRepository.findOne({
      where: { assignment: { id: assignmentId }, trainee: { id: traineeId } } as any,
    });

    if (submission) {
      submission.submissionText = submissionText;
      submission.attachmentUrl = attachmentUrl || submission.attachmentUrl;
      submission.status = 'Submitted';
      submission.submittedAt = new Date();
    } else {
      submission = this.submissionRepository.create({
        assignment: { id: assignmentId } as any,
        trainee: { id: traineeId } as any,
        submissionText,
        attachmentUrl,
        status: 'Submitted',
        submittedAt: new Date(),
      });
    }

    const saved = await this.submissionRepository.save(submission);

    // Notify assignment creator (trainer) that a submission awaits evaluation
    const trainerId = assignment.createdBy?.id || (assignment as any).createdById;
    if (this.notificationService && trainerId) {
      await this.notificationService.create({
        userId: trainerId,
        type: 'submission_pending',
        title: 'Submission ready for evaluation',
        message: `A trainee submitted "${assignment.title}" for review.`,
        link: '/evaluations',
        relatedEntityType: 'submission',
        relatedEntityId: saved.id,
      });
    }

    return saved;
  }

  async findAll(): Promise<AssignmentEntity[]> {
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
    return await this.enrichAssignmentsWithStatus(assignments);
  }

  /**
   * Derive Pending / In Progress / Submitted / Accepted / Rejected from submissions.
   */
  async enrichAssignmentsWithStatus(assignments: AssignmentEntity[]): Promise<any[]> {
    if (!assignments.length) return [];
    const ids = new Set(assignments.map((a) => a.id));
    const allSubs = await this.submissionRepository.find({
      relations: ['trainee', 'assignment'],
      order: { submittedAt: 'DESC' } as any,
    });

    const byAssignment = new Map<string, AssignmentSubmissionEntity[]>();
    for (const s of allSubs) {
      const aid = s.assignment?.id;
      if (!aid || !ids.has(aid)) continue;
      if (!byAssignment.has(aid)) byAssignment.set(aid, []);
      byAssignment.get(aid)!.push(s);
    }

    return assignments.map((a) => {
      const subs = byAssignment.get(a.id) || [];
      let status = 'Pending';
      let score: number | null = null;
      const latestSubmission: AssignmentSubmissionEntity | null = subs[0] || null;

      if (subs.length === 0) {
        status = 'Pending';
      } else {
        const hasSubmitted = subs.some((s) => s.status === 'Submitted');
        const hasAccepted = subs.some((s) => s.status === 'Accepted' || s.status === 'Evaluated');
        const hasRejected = subs.some((s) => s.status === 'Rejected');
        if (hasSubmitted) status = 'Submitted';
        else if (hasAccepted) status = 'Accepted';
        else if (hasRejected) status = 'Rejected';
        else status = 'In Progress';

        const scored = subs.find((s) => typeof s.score === 'number');
        if (scored) score = scored.score;
      }

      return {
        ...a,
        status,
        score,
        maxScore: a.maxScore,
        submissions: subs,
        latestSubmission,
        traineeCount: (a.assignedToTraineeIds || []).length || subs.length,
      };
    });
  }

  async findExternalAssignments(): Promise<AssignmentEntity[]> {
    const all = await this.findAll();
    return all.filter(
      (a) =>
        String(a.assignmentType || '').toLowerCase() === 'external' ||
        (!a.lesson && !a.module && !a.learningPath),
    );
  }

  async findMyAssignments(traineeId: string): Promise<AssignmentEntity[]> {
    const all = await this.findAll();
    const paths = await this.learningPathRepository.find();
    const enrolledPathIds = new Set(
      paths
        .filter((p) => (p.assignedToTraineeIds || []).includes(traineeId))
        .map((p) => p.id),
    );

    return all.filter((a) => {
      const assignedDirect = (a.assignedToTraineeIds || []).includes(traineeId);
      if (assignedDirect) return true;

      const pathId =
        a.learningPath?.id ||
        (a as any).learningPathId ||
        a.module?.learningPath?.id ||
        a.lesson?.module?.learningPath?.id;
      if (pathId && enrolledPathIds.has(pathId)) return true;
      return false;
    });
  }

  async findByLessonId(lessonId: string): Promise<AssignmentEntity[]> {
    return await this.repository.find({
      where: { lesson: { id: lessonId } } as any,
      relations: ['createdBy', 'lesson', 'module'],
    });
  }

  async findTraineeSubmission(assignmentId: string, traineeId: string) {
    return await this.submissionRepository.findOne({
      where: { assignment: { id: assignmentId }, trainee: { id: traineeId } } as any,
    });
  }

  async findSubmissionsByAssignment(assignmentId: string) {
    return await this.submissionRepository.find({
      where: { assignment: { id: assignmentId } } as any,
      relations: ['trainee'],
    });
  }

  async findMySubmissions(traineeId: string): Promise<AssignmentSubmissionEntity[]> {
    if (!traineeId) {
      throw new BadRequestException('Trainee ID is required.');
    }

    return await this.submissionRepository.find({
      where: {
        trainee: { id: traineeId },
      } as any,
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
}
