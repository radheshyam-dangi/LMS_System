import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, IsNull, Not, In } from 'typeorm';
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
    this.visitRepository = this.datasource.getRepository(
      UserResourceVisitEntity,
    );
    this.lessonRepository = this.datasource.getRepository(LessonEntity);
    this.resourceRepository = this.datasource.getRepository(ResourceEntity);
    this.assignmentRepository = this.datasource.getRepository(AssignmentEntity);
    this.submissionRepository = this.datasource.getRepository(
      AssignmentSubmissionEntity,
    );
    this.pathRepository = this.datasource.getRepository(LearningPathEntity);
  }

  async completeLesson(userId: string, lessonId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
    });
    if (!lesson) throw new NotFoundException(`Lesson "${lessonId}" not found.`);

    let progress = await this.repository.findOne({
      where: { user: { id: userId }, lesson: { id: lessonId } },
      relations: ['user', 'lesson'],
    });

    if (!progress) {
      progress = this.repository.create({
        user: { id: userId },
        lesson: { id: lessonId },
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
    const resource = await this.resourceRepository.findOne({
      where: { id: resourceId },
    });
    if (!resource)
      throw new NotFoundException(`Resource "${resourceId}" not found.`);

    let visit = await this.visitRepository.findOne({
      where: { user: { id: userId }, resource: { id: resourceId } },
    });

    if (!visit) {
      visit = this.visitRepository.create({
        user: { id: userId },
        resource: { id: resourceId },
        visitedAt: new Date(),
      });
    } else {
      visit.visitedAt = new Date();
    }

    return await this.visitRepository.save(visit);
  }

  async findForUser(userId: string) {
    return await this.repository.find({
      where: { user: { id: userId } },
      relations: ['lesson', 'lesson.module'],
      order: { completedAt: 'DESC' },
    });
  }

  async findVisitsForUser(userId: string) {
    return await this.visitRepository.find({
      where: { user: { id: userId } },
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
      },
      relations: ['lesson', 'lesson.module', 'lesson.module.learningPath'],
    });

    const enrolledPathIds = new Set<string>();
    if (learningPathId) {
      enrolledPathIds.add(learningPathId);
    } else {
      const allPaths = await this.pathRepository.find();
      allPaths.forEach((p) => {
        if (p.assignedToTraineeIds && p.assignedToTraineeIds.includes(userId)) {
          enrolledPathIds.add(p.id);
        }
      });
      const enrollments = await this.datasource
        .getRepository('EnrollmentEntity')
        .find({
          where: { user: { id: userId }, status: 'active' },
          relations: ['learningPath'],
        });
      enrollments.forEach((e) => {
        if ((e as any).learningPath?.id)
          enrolledPathIds.add((e as any).learningPath.id);
      });
    }

    let lessonScope = await this.lessonRepository.find({
      relations: ['module', 'module.learningPath'],
    });
    if (enrolledPathIds.size > 0) {
      lessonScope = lessonScope.filter(
        (l) =>
          (l.module?.learningPath?.id &&
            enrolledPathIds.has(l.module.learningPath.id)) ||
          ((l as any).learningPathId &&
            enrolledPathIds.has((l as any).learningPathId)),
      );
    } else {
      lessonScope = [];
    }

    const lessonIds = new Set(lessonScope.map((l) => l.id));
    const completedLessons = completedRows.filter((r) =>
      lessonIds.has(r.lesson?.id),
    ).length;
    const totalLessons = lessonScope.length;

    const visits = await this.findVisitsForUser(userId);
    let resources = await this.resourceRepository.find({
      relations: [
        'module',
        'module.learningPath',
        'lesson',
        'lesson.module',
        'lesson.module.learningPath',
      ],
    });
    if (enrolledPathIds.size > 0) {
      resources = resources.filter((r) => {
        const pathId =
          r.module?.learningPath?.id ||
          r.lesson?.module?.learningPath?.id ||
          (r.module as any)?.learningPathId;
        return pathId && enrolledPathIds.has(pathId);
      });
    } else {
      resources = [];
    }
    const resourceIds = new Set(resources.map((r) => r.id));
    const visitedResources = visits.filter((v) =>
      resourceIds.has(v.resource?.id),
    ).length;
    const totalResources = resources.length;

    // Assignments in scope
    const allAssignments = await this.assignmentRepository.find({
      relations: [
        'lesson',
        'lesson.module',
        'lesson.module.learningPath',
        'module',
        'module.learningPath',
        'learningPath',
      ],
    });
    const scopedAssignments = allAssignments.filter((a) => {
      if (enrolledPathIds.size > 0) {
        const pathId =
          a.learningPath?.id ||
          a.module?.learningPath?.id ||
          a.lesson?.module?.learningPath?.id;
        return pathId && enrolledPathIds.has(pathId);
      }
      return false; // If no paths, no assignments
    });

    const submissions = await this.submissionRepository.find({
      where: { trainee: { id: userId } },
      relations: ['assignment'],
    });
    const subByAssign = new Map(submissions.map((s) => [s.assignment?.id, s]));

    let tasksSubmitted = 0;
    let tasksAccepted = 0;
    let tasksRejected = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    let maxScoreSum = 0;

    for (const a of scopedAssignments) {
      const sub = subByAssign.get(a.id);
      if (!sub) continue;
      if (
        ['Submitted', 'Accepted', 'Rejected', 'Evaluated'].includes(sub.status)
      ) {
        tasksSubmitted++;
      }
      if (sub.status === 'Accepted' || sub.status === 'Evaluated')
        tasksAccepted++;
      if (sub.status === 'Rejected') tasksRejected++;
      if (typeof sub.score === 'number') {
        scoreSum += sub.score;
        maxScoreSum += Number(a.maxScore || 100);
        scoreCount++;
      }
    }

    const lessonPct =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;
    const resourcePct =
      totalResources > 0
        ? Math.round((visitedResources / totalResources) * 100)
        : 100;
    const taskPct =
      scopedAssignments.length > 0
        ? Math.round((tasksAccepted / scopedAssignments.length) * 100)
        : 0;

    const totalItems = totalLessons + totalResources + scopedAssignments.length;
    const completedItems = completedLessons + visitedResources + tasksAccepted;
    const completionPercent = totalItems > 0 
      ? (completedItems === totalItems ? 100 : Math.round((completedItems / totalItems) * 100))
      : 0;

    const completedLessonIds = completedRows
      .map((r) => r.lesson?.id)
      .filter(Boolean);
    const completedLessonIdsSet = new Set(completedLessonIds);
    const lessonsByModule = new Map<string, string[]>();
    lessonScope.forEach((l) => {
      const mid = l.module?.id;
      if (mid) {
        if (!lessonsByModule.has(mid)) lessonsByModule.set(mid, []);
        lessonsByModule.get(mid)!.push(l.id);
      }
    });

    const completedModuleIds: string[] = [];
    lessonsByModule.forEach((lIds, mid) => {
      if (
        lIds.length > 0 &&
        lIds.every((id) => completedLessonIdsSet.has(id))
      ) {
        completedModuleIds.push(mid);
      }
    });

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
      averageScore:
        maxScoreSum > 0
          ? Math.min(100, Math.round((scoreSum / maxScoreSum) * 100))
          : 0,
      completionPercent,
      lessonProgressPercent: lessonPct,
      resourceProgressPercent: resourcePct,
      taskProgressPercent: taskPct,
      completedLessonIds,
      visitedResourceIds: visits.map((v) => v.resource?.id).filter(Boolean),
      completedModuleIds,
    };
  }

  /**
   * Trainer cohort overview for assigned trainees.
   */
  async cohortOverview(trainerId?: string) {
    const paths = await this.pathRepository.find();
    const assignedTraineeIds = new Set<string>();
    paths.forEach((p) =>
      (p.assignedToTraineeIds || []).forEach((id) =>
        assignedTraineeIds.add(id),
      ),
    );

    const externalAssignments = await this.assignmentRepository.find();
    externalAssignments.forEach((a) =>
      (a.assignedToTraineeIds || []).forEach((id) =>
        assignedTraineeIds.add(id),
      ),
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
   * Calculates dynamic real-time progress for a specific module using proportional (weighted) calculation.
   * W_L (Lessons) = 40%, W_T (Tasks) = 50%, W_R (Resources) = 10%.
   */
  async getModuleProgress(userId: string, moduleId: string) {
    if (!userId || !moduleId) {
      return { completionPercent: 0 };
    }

    // 1. Fetch total items for the module
    const module = await this.datasource.getRepository('ModuleEntity').findOne({
      where: { id: moduleId },
      relations: ['lessons', 'resources', 'lessons.assignments'],
    });

    if (!module) return { completionPercent: 0 };

    const totalLessons = (module.lessons || []).length;
    const totalResources = (module.resources || []).length;
    
    // Tasks can be directly on the module or inside lessons
    const fromLessons = (module.lessons || []).flatMap((l: any) => l.assignments || []);
    
    // Fetch assignments attached directly to the module
    const fromModule = await this.datasource.getRepository('AssignmentEntity').find({
      where: { module: { id: moduleId } } as any,
    });
    
    const allAssignments = [...fromLessons, ...fromModule];
    const totalTasks = allAssignments.length;

    if (totalLessons === 0 && totalResources === 0 && totalTasks === 0) {
      return { completionPercent: 0 };
    }

    // 2. Fetch completed items for the user
    const lessonIds = (module.lessons || []).map((l: any) => l.id);
    const resourceIds = (module.resources || []).map((r: any) => r.id);
    const assignmentIds = allAssignments.map((a: any) => a.id);

    let completedLessons = 0;
    if (lessonIds.length > 0) {
      completedLessons = await this.repository.count({
        where: {
          user: { id: userId },
          isCompleted: true,
          lesson: { id: In(lessonIds) },
        } as any,
      });
    }

    let completedResources = 0;
    if (resourceIds.length > 0) {
      completedResources = await this.datasource.getRepository('UserResourceVisitEntity').count({
        where: {
          user: { id: userId },
          resource: { id: In(resourceIds) },
        } as any,
      });
    }

    let completedTasks = 0;
    if (assignmentIds.length > 0) {
      completedTasks = await this.submissionRepository.count({
        where: {
          trainee: { id: userId },
          assignment: { id: In(assignmentIds) },
          status: In(['Submitted', 'Accepted', 'Evaluated', 'Approved']),
        } as any,
      });
    }

    // 3. Proportional Weights Calculation
    const W_L = 40;
    const W_T = 50;
    const W_R = 10;

    const current_W_L = totalLessons > 0 ? W_L : 0;
    const current_W_T = totalTasks > 0 ? W_T : 0;
    const current_W_R = totalResources > 0 ? W_R : 0;

    const total_weight = current_W_L + current_W_T + current_W_R;
    
    if (total_weight === 0) {
      return { completionPercent: 0 };
    }

    const ratio_L = totalLessons > 0 ? (completedLessons / totalLessons) : 0;
    const ratio_T = totalTasks > 0 ? (completedTasks / totalTasks) : 0;
    const ratio_R = totalResources > 0 ? (completedResources / totalResources) : 0;

    const finalProgress = ((ratio_L * current_W_L) + (ratio_T * current_W_T) + (ratio_R * current_W_R)) / total_weight * 100;
    
    return {
      completionPercent: Math.round(finalProgress),
      completedLessons,
      totalLessons,
      visitedResources: completedResources,
      totalResources,
      tasksAccepted: completedTasks,
      totalAssignments: totalTasks,
    };
  }

  /**
   * Calculates dynamic real-time progress for all Learning Paths.
   * For Trainees: Computes user progress based on watched lessons, accepted/submitted tasks, and visited resources.
   * For Trainers/Admins: Computes cohort progress as the average progress of all enrolled trainees.
   */
  async getPathProgressSummary(currentUserId: string) {
    const paths = await this.pathRepository.find();
    const allModules = await this.datasource.getRepository('ModuleEntity').find({ relations: ['learningPath'] });
    const allLessons = await this.lessonRepository.find({
      relations: ['module', 'module.learningPath'],
    });
    const allResources = await this.resourceRepository.find({
      relations: [
        'module',
        'module.learningPath',
        'lesson',
        'lesson.module',
        'lesson.module.learningPath',
      ],
    });
    const allAssignments = await this.assignmentRepository.find({
      relations: [
        'lesson',
        'lesson.module',
        'lesson.module.learningPath',
        'module',
        'module.learningPath',
        'learningPath',
      ],
    });

    const allLessonProgress = await this.repository.find({
      where: { isCompleted: true, completedAt: Not(IsNull()) },
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
        traineeProgressMap: Record<string, number>;
      }
    > = {};

    for (const path of paths) {
      const pathId = path.id;
      const enrolledTraineeIds: string[] = path.assignedToTraineeIds || [];

      const pathModules = allModules.filter(m => {
        const s = (m.status || '').toLowerCase();
        if (['draft', 'archived', 'deleted', 'upcoming'].includes(s)) return false;
        return m.learningPath?.id === pathId || (m as any).learningPathId === pathId;
      });

      // Path scope items
      const pathLessons = allLessons.filter(
        (l) => {
          const s = (l.module?.status || '').toLowerCase();
          if (['draft', 'archived', 'deleted', 'upcoming'].includes(s)) return false;
          return l.module?.learningPath?.id === pathId || (l as any).learningPathId === pathId;
        }
      );
      const pathLessonIds = new Set(pathLessons.map((l) => l.id));

      const pathResources = allResources.filter((r) => {
        const s = (r.module?.status || r.lesson?.module?.status || '').toLowerCase();
        if (['draft', 'archived', 'deleted', 'upcoming'].includes(s)) return false;
        const lpId =
          r.module?.learningPath?.id ||
          r.lesson?.module?.learningPath?.id ||
          (r.module as any)?.learningPathId;
        return lpId === pathId;
      });
      const pathResourceIds = new Set(pathResources.map((r) => r.id));

      const pathAssignments = allAssignments.filter((a) => {
        const s = (a.module?.status || a.lesson?.module?.status || '').toLowerCase();
        if (['draft', 'archived', 'deleted', 'upcoming'].includes(s)) return false;
        const lpId =
          a.learningPath?.id ||
          a.module?.learningPath?.id ||
          a.lesson?.module?.learningPath?.id;
        return lpId === pathId;
      });
      const pathAssignmentIds = new Set(pathAssignments.map((a) => a.id));

      const modulesData = pathModules.map(mod => {
        const mLessons = pathLessons.filter(l => l.module?.id === mod.id);
        const mResources = pathResources.filter(r => r.module?.id === mod.id || r.lesson?.module?.id === mod.id);
        const mAssignments = pathAssignments.filter(a => a.module?.id === mod.id || a.lesson?.module?.id === mod.id);
        
        return {
          id: mod.id,
          lessonIds: new Set(mLessons.map(l => l.id)),
          resourceIds: new Set(mResources.map(r => r.id)),
          assignmentIds: new Set(mAssignments.map(a => a.id)),
          totalLessons: mLessons.length,
          totalResources: mResources.length,
          totalAssignments: mAssignments.length,
        };
      });

      // Helper function to calculate a single user's progress % on this path
      const calcUserProgress = (uid: string): number => {
        if (!uid || pathModules.length === 0) return 0;

        let totalModProgress = 0;
        
        for (const modData of modulesData) {
          const watchedLessons = allLessonProgress.filter(
            (lp) => String(lp.user?.id) === String(uid) && modData.lessonIds.has(lp.lesson?.id)
          ).length;
          
          const visitedRes = allResourceVisits.filter(
            (rv) => String(rv.user?.id) === String(uid) && modData.resourceIds.has(rv.resource?.id)
          ).length;
          
          const submittedTasks = allSubmissions.filter(
            (sub) => String(sub.trainee?.id) === String(uid) && modData.assignmentIds.has(sub.assignment?.id) && ['Submitted', 'Accepted', 'Evaluated', 'Approved'].includes(sub.status)
          ).length;
          
          const W_L = 40; const W_T = 50; const W_R = 10;
          const current_W_L = modData.totalLessons > 0 ? W_L : 0;
          const current_W_T = modData.totalAssignments > 0 ? W_T : 0;
          const current_W_R = modData.totalResources > 0 ? W_R : 0;
          
          const total_weight = current_W_L + current_W_T + current_W_R;
          
          if (total_weight > 0) {
            const ratio_L = modData.totalLessons > 0 ? (watchedLessons / modData.totalLessons) : 0;
            const ratio_T = modData.totalAssignments > 0 ? (submittedTasks / modData.totalAssignments) : 0;
            const ratio_R = modData.totalResources > 0 ? (visitedRes / modData.totalResources) : 0;
            
            const modProg = ((ratio_L * current_W_L) + (ratio_T * current_W_T) + (ratio_R * current_W_R)) / total_weight * 100;
            totalModProgress += modProg;
          }
        }
        
        return Math.round(totalModProgress / pathModules.length);
      };

      // 1. Logged-in user's progress
      const userProgressPercent = calcUserProgress(currentUserId);

      // 2. Cohort average progress for assigned trainees
      let cohortProgressPercent = 0;
      const traineeProgressMap: Record<string, number> = {};

      if (enrolledTraineeIds.length > 0) {
        let sum = 0;
        for (const tid of enrolledTraineeIds) {
          const progress = calcUserProgress(tid);
          traineeProgressMap[tid] = progress;
          sum += progress;
        }
        cohortProgressPercent = Math.round(sum / enrolledTraineeIds.length);
      }

      result[pathId] = {
        userProgressPercent,
        cohortProgressPercent,
        enrolledCount: enrolledTraineeIds.length,
        totalLessons: pathLessonIds.size,
        totalAssignments: pathAssignmentIds.size,
        totalResources: pathResourceIds.size,
        traineeProgressMap,
      };
    }

    return result;
  }
}
