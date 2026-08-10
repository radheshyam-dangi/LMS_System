import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, IsNull, Not } from 'typeorm';
import { UserLessonProgressEntity } from '../../entities/userLessonProgress.entity';
import { UserResourceVisitEntity } from '../../entities/userResourceVisit.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { ResourceEntity } from '../../entities/resource.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';

@Injectable()
export class ProgressEntityService {
  private repository: Repository<UserLessonProgressEntity>;
  private visitRepository: Repository<UserResourceVisitEntity>;
  private lessonRepository: Repository<LessonEntity>;
  private resourceRepository: Repository<ResourceEntity>;
  private assignmentRepository: Repository<AssignmentEntity>;
  private submissionRepository: Repository<AssignmentSubmissionEntity>;
  private pathRepository: Repository<LearningPathEntity>;

  constructor(private readonly datasource: DataSource) {
    this.repository = this.datasource.getRepository(UserLessonProgressEntity);
    this.visitRepository = this.datasource.getRepository(UserResourceVisitEntity);
    this.lessonRepository = this.datasource.getRepository(LessonEntity);
    this.resourceRepository = this.datasource.getRepository(ResourceEntity);
    this.assignmentRepository = this.datasource.getRepository(AssignmentEntity);
    this.submissionRepository = this.datasource.getRepository(AssignmentSubmissionEntity);
    this.pathRepository = this.datasource.getRepository(LearningPathEntity);
  }

  async completeLesson(userId: string, lessonId: string) {
    const lesson = await this.lessonRepository.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException(`Lesson "${lessonId}" not found.`);

    let progress = await this.repository.findOne({
      where: { user: { id: userId }, lesson: { id: lessonId } } as any,
      relations: ['user', 'lesson'],
    });

    if (!progress) {
      progress = this.repository.create({
        user: { id: userId } as any,
        lesson: { id: lessonId } as any,
        completedAt: new Date(),
        isCompleted: true,
      });
    } else {
      progress.completedAt = new Date();
      progress.isCompleted = true;
    }

    return await this.repository.save(progress);
  }

  async visitResource(userId: string, resourceId: string) {
    const resource = await this.resourceRepository.findOne({ where: { id: resourceId } });
    if (!resource) throw new NotFoundException(`Resource "${resourceId}" not found.`);

    let visit = await this.visitRepository.findOne({
      where: { user: { id: userId }, resource: { id: resourceId } } as any,
    });

    if (!visit) {
      visit = this.visitRepository.create({
        user: { id: userId } as any,
        resource: { id: resourceId } as any,
        visitedAt: new Date(),
      });
    } else {
      visit.visitedAt = new Date();
    }

    return await this.visitRepository.save(visit);
  }

  async findForUser(userId: string) {
    return await this.repository.find({
      where: { user: { id: userId } } as any,
      relations: ['lesson', 'lesson.module'],
      order: { completedAt: 'DESC' },
    });
  }

  async findVisitsForUser(userId: string) {
    return await this.visitRepository.find({
      where: { user: { id: userId } } as any,
      relations: ['resource'],
      order: { visitedAt: 'DESC' },
    });
  }

  /**
   * Per-user progress snapshot used by Module Details + trainee dashboard.
   */
  async statsForUser(userId: string, learningPathId?: string) {
    const completedRows = await this.repository.find({
      where: {
        user: { id: userId },
        isCompleted: true,
        completedAt: Not(IsNull()),
      } as any,
      relations: ['lesson', 'lesson.module', 'lesson.module.learningPath'],
    });

    let lessonScope = await this.lessonRepository.find({
      relations: ['module', 'module.learningPath'],
    });
    if (learningPathId) {
      lessonScope = lessonScope.filter(
        (l) =>
          l.module?.learningPath?.id === learningPathId ||
          (l as any).learningPathId === learningPathId,
      );
    }

    const lessonIds = new Set(lessonScope.map((l) => l.id));
    const completedLessons = completedRows.filter((r) => lessonIds.has(r.lesson?.id)).length;
    const totalLessons = lessonScope.length;

    const visits = await this.findVisitsForUser(userId);
    let resources = await this.resourceRepository.find({
      relations: ['module', 'module.learningPath', 'lesson', 'lesson.module', 'lesson.module.learningPath'],
    });
    if (learningPathId) {
      resources = resources.filter((r) => {
        const pathId =
          r.module?.learningPath?.id ||
          r.lesson?.module?.learningPath?.id ||
          (r.module as any)?.learningPathId;
        return pathId === learningPathId;
      });
    }
    const resourceIds = new Set(resources.map((r) => r.id));
    const visitedResources = visits.filter((v) => resourceIds.has(v.resource?.id)).length;
    const totalResources = resources.length;

    // Assignments in scope
    const allAssignments = await this.assignmentRepository.find({
      relations: ['lesson', 'lesson.module', 'lesson.module.learningPath', 'module', 'module.learningPath', 'learningPath'],
    });
    const scopedAssignments = allAssignments.filter((a) => {
      if ((a.assignedToTraineeIds || []).includes(userId)) return true;
      if (!learningPathId) return true;
      const pathId =
        a.learningPath?.id ||
        a.module?.learningPath?.id ||
        a.lesson?.module?.learningPath?.id;
      return pathId === learningPathId;
    });

    const submissions = await this.submissionRepository.find({
      where: { trainee: { id: userId } } as any,
      relations: ['assignment'],
    });
    const subByAssign = new Map(submissions.map((s) => [s.assignment?.id, s]));

    let tasksSubmitted = 0;
    let tasksAccepted = 0;
    let tasksRejected = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const a of scopedAssignments) {
      const sub = subByAssign.get(a.id);
      if (!sub) continue;
      if (['Submitted', 'Accepted', 'Rejected', 'Evaluated'].includes(sub.status)) {
        tasksSubmitted++;
      }
      if (sub.status === 'Accepted' || sub.status === 'Evaluated') tasksAccepted++;
      if (sub.status === 'Rejected') tasksRejected++;
      if (typeof sub.score === 'number') {
        scoreSum += sub.score;
        scoreCount++;
      }
    }

    const lessonPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const resourcePct = totalResources > 0 ? Math.round((visitedResources / totalResources) * 100) : 100;
    const taskPct =
      scopedAssignments.length > 0
        ? Math.round((tasksAccepted / scopedAssignments.length) * 100)
        : 0;

    // Weighted overall: lessons 40%, resources 20%, tasks 40%
    const completionPercent = Math.round(lessonPct * 0.4 + resourcePct * 0.2 + taskPct * 0.4);

    return {
      completedLessons,
      totalLessons,
      visitedResources,
      totalResources,
      totalAssignments: scopedAssignments.length,
      tasksSubmitted,
      tasksAccepted,
      tasksRejected,
      tasksPending: Math.max(0, scopedAssignments.length - tasksSubmitted),
      averageScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
      completionPercent,
      lessonProgressPercent: lessonPct,
      resourceProgressPercent: resourcePct,
      taskProgressPercent: taskPct,
      completedLessonIds: completedRows.map((r) => r.lesson?.id).filter(Boolean),
      visitedResourceIds: visits.map((v) => v.resource?.id).filter(Boolean),
    };
  }

  /**
   * Trainer cohort overview for assigned trainees.
   */
  async cohortOverview(trainerId?: string) {
    const paths = await this.pathRepository.find();
    const assignedTraineeIds = new Set<string>();
    paths.forEach((p) => (p.assignedToTraineeIds || []).forEach((id) => assignedTraineeIds.add(id)));

    const externalAssignments = await this.assignmentRepository.find();
    externalAssignments.forEach((a) =>
      (a.assignedToTraineeIds || []).forEach((id) => assignedTraineeIds.add(id)),
    );

    const traineeIds = Array.from(assignedTraineeIds);
    const snapshots = [];
    for (const tid of traineeIds.slice(0, 100)) {
      const stats = await this.statsForUser(tid);
      snapshots.push({ userId: tid, ...stats });
    }

    const fullyWatchedLessons = snapshots.filter(
      (s) => s.totalLessons > 0 && s.completedLessons >= s.totalLessons,
    ).length;
    const fullyVisitedResources = snapshots.filter(
      (s) => s.totalResources === 0 || s.visitedResources >= s.totalResources,
    ).length;
    const submittedAny = snapshots.filter((s) => s.tasksSubmitted > 0).length;

    return {
      totalAssignedTrainees: traineeIds.length,
      traineesSubmitted: submittedAny,
      traineesFullyWatchedLessons: fullyWatchedLessons,
      traineesFullyVisitedResources: fullyVisitedResources,
      snapshots,
    };
  }

  /**
   * Calculates dynamic real-time progress for all Learning Paths.
   * For Trainees: Computes user progress based on watched lessons, accepted/submitted tasks, and visited resources.
   * For Trainers/Admins: Computes cohort progress as the average progress of all enrolled trainees.
   */
  async getPathProgressSummary(currentUserId: string) {
    const paths = await this.pathRepository.find();
    const allLessons = await this.lessonRepository.find({
      relations: ['module', 'module.learningPath'],
    });
    const allResources = await this.resourceRepository.find({
      relations: ['module', 'module.learningPath', 'lesson', 'lesson.module', 'lesson.module.learningPath'],
    });
    const allAssignments = await this.assignmentRepository.find({
      relations: ['lesson', 'lesson.module', 'lesson.module.learningPath', 'module', 'module.learningPath', 'learningPath'],
    });

    const allLessonProgress = await this.repository.find({
      where: { isCompleted: true, completedAt: Not(IsNull()) } as any,
      relations: ['user', 'lesson'],
    });

    const allResourceVisits = await this.visitRepository.find({
      relations: ['user', 'resource'],
    });

    const allSubmissions = await this.submissionRepository.find({
      relations: ['trainee', 'assignment'],
    });

    const result: Record<
      string,
      {
        userProgressPercent: number;
        cohortProgressPercent: number;
        enrolledCount: number;
        totalLessons: number;
        totalAssignments: number;
        totalResources: number;
      }
    > = {};

    for (const path of paths) {
      const pathId = path.id;
      const enrolledTraineeIds: string[] = path.assignedToTraineeIds || [];

      // Path scope items
      const pathLessons = allLessons.filter(
        (l) => l.module?.learningPath?.id === pathId || (l as any).learningPathId === pathId,
      );
      const pathLessonIds = new Set(pathLessons.map((l) => l.id));

      const pathResources = allResources.filter((r) => {
        const lpId =
          r.module?.learningPath?.id ||
          r.lesson?.module?.learningPath?.id ||
          (r.module as any)?.learningPathId;
        return lpId === pathId;
      });
      const pathResourceIds = new Set(pathResources.map((r) => r.id));

      const pathAssignments = allAssignments.filter((a) => {
        const lpId =
          a.learningPath?.id ||
          a.module?.learningPath?.id ||
          a.lesson?.module?.learningPath?.id;
        return lpId === pathId;
      });
      const pathAssignmentIds = new Set(pathAssignments.map((a) => a.id));

      const totalItems = pathLessonIds.size + pathAssignmentIds.size + pathResourceIds.size;

      // Helper function to calculate a single user's progress % on this path
      const calcUserProgress = (uid: string): number => {
        if (!uid || totalItems === 0) return 0;

        const watchedLessons = allLessonProgress.filter(
          (lp) => String(lp.user?.id) === String(uid) && pathLessonIds.has(lp.lesson?.id),
        ).length;

        const visitedRes = allResourceVisits.filter(
          (rv) => String(rv.user?.id) === String(uid) && pathResourceIds.has(rv.resource?.id),
        ).length;

        const submittedTasks = allSubmissions.filter(
          (sub) =>
            String(sub.trainee?.id) === String(uid) &&
            pathAssignmentIds.has(sub.assignment?.id) &&
            ['Submitted', 'Accepted', 'Evaluated'].includes(sub.status),
        ).length;

        const completedItems = watchedLessons + visitedRes + submittedTasks;
        return Math.min(100, Math.round((completedItems / totalItems) * 100));
      };

      // 1. Logged-in user's progress
      const userProgressPercent = calcUserProgress(currentUserId);

      // 2. Cohort average progress for assigned trainees
      let cohortProgressPercent = 0;
      if (enrolledTraineeIds.length > 0) {
        const sum = enrolledTraineeIds.reduce((acc, tid) => acc + calcUserProgress(tid), 0);
        cohortProgressPercent = Math.round(sum / enrolledTraineeIds.length);
      }

      result[pathId] = {
        userProgressPercent,
        cohortProgressPercent,
        enrolledCount: enrolledTraineeIds.length,
        totalLessons: pathLessonIds.size,
        totalAssignments: pathAssignmentIds.size,
        totalResources: pathResourceIds.size,
      };
    }

    return result;
  }
}
