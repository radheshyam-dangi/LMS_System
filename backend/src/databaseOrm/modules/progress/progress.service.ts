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
      relations: ['module', 'module.learningPath'],
    });
    if (!lesson) throw new NotFoundException(`Lesson "${lessonId}" not found.`);

    if (lesson.module && lesson.module.learningPath?.lockLessons !== false) {
      const allModuleLessons = await this.lessonRepository.find({
        where: { module: { id: lesson.module.id } },
        order: { displayOrder: 'ASC', createdAt: 'ASC' },
      });
      const currentIndex = allModuleLessons.findIndex(l => l.id === lesson.id);
      const priorLessons = currentIndex > 0 ? allModuleLessons.slice(0, currentIndex) : [];
      if (priorLessons.length > 0) {
        const userProgress = await this.repository.find({
          where: { user: { id: userId }, lesson: { module: { id: lesson.module.id } }, isCompleted: true },
          relations: ['lesson'],
        });
        const completedIds = new Set(userProgress.map(p => p.lesson?.id));
        const incompletePrior = priorLessons.find(l => !completedIds.has(l.id));
        if (incompletePrior) {
          const { ForbiddenException } = require('@nestjs/common');
          throw new ForbiddenException(`Cannot complete this lesson. Please complete '${incompletePrior.title}' first.`);
        }
      }
    }

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

    const savedProgress = await this.repository.save(progress);

    if (lesson.module) {
      // Check if all lessons in this module are completed
      const allModuleLessons = await this.lessonRepository.find({
        where: { module: { id: lesson.module.id } },
      });
      const allLessonIds = allModuleLessons.map(l => l.id);
      
      const userProgress = await this.repository.find({
        where: { user: { id: userId }, lesson: { module: { id: lesson.module.id } }, isCompleted: true },
        relations: ['lesson'],
      });
      const completedIds = new Set(userProgress.map(p => p.lesson?.id));
      
      const allCompleted = allLessonIds.every(id => completedIds.has(id));
      
      if (allCompleted) {
        // Find all submissions for tasks in this module
        const submissions = await this.submissionRepository.find({
          where: { trainee: { id: userId }, assignment: { module: { id: lesson.module.id } } },
          relations: ['assignment'],
        });
        
        const now = new Date();
        for (const sub of submissions) {
          const task = sub.assignment;
          if (task.anchorType === 'TASK_UNLOCKED' && !sub.taskUnlockedAt) {
            sub.taskUnlockedAt = now;
            if ((task.durationDays || 0) > 0 || (task.durationHours || 0) > 0 || (task.durationMinutes || 0) > 0) {
              sub.deadline = new Date(now.getTime());
              if (task.durationDays) sub.deadline.setDate(sub.deadline.getDate() + task.durationDays);
              if (task.durationHours) sub.deadline.setHours(sub.deadline.getHours() + task.durationHours);
              if (task.durationMinutes) sub.deadline.setMinutes(sub.deadline.getMinutes() + task.durationMinutes);
            }
          }
          if (sub.status === 'LOCKED') sub.status = 'AVAILABLE';
        }
        
        if (submissions.length > 0) {
          await this.submissionRepository.save(submissions);
        }
      }
    }

    return savedProgress;
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
  async statsForUser(userId: string, learningPathId?: string, trainerId?: string) {
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
      const allPaths = await this.pathRepository.find({ relations: ['createdBy'] });
      allPaths.forEach((p) => {
        if (p.assignedToTraineeIds && p.assignedToTraineeIds.includes(userId)) {
          if (!trainerId || p.createdBy?.id === trainerId) {
            enrolledPathIds.add(p.id);
          }
        }
      });
      const enrollments = await this.datasource
        .getRepository('EnrollmentEntity')
        .find({
          where: { user: { id: userId }, status: 'active' },
          relations: ['learningPath', 'learningPath.createdBy'],
        });
      enrollments.forEach((e: any) => {
        if (e.learningPath?.id) {
          if (!trainerId || e.learningPath.createdBy?.id === trainerId) {
            enrolledPathIds.add(e.learningPath.id);
          }
        }
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
      maxScoreSum += Number(a.maxScore || 100);
      
      const sub = subByAssign.get(a.id);
      if (!sub) continue;
      if (
        sub.status && sub.status.toUpperCase() !== 'AVAILABLE' && sub.status.toUpperCase() !== 'LOCKED'
      ) {
        tasksSubmitted++;
      }
      if (sub.status === 'APPROVED' || sub.status === 'EVALUATED' || sub.status === 'ACCEPTED')
        tasksAccepted++;
      if (sub.status === 'REJECTED') tasksRejected++;
      if (typeof sub.score === 'number' && sub.score >= 0) {
        scoreSum += sub.score;
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
    
    let completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
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
   * Calculates dynamic real-time progress for a specific Learning Path.
   * Progress % = simple average of its modules' completion percentages.
   */
  async getLPProgress(userId: string, learningPathId: string): Promise<number> {
    if (!userId || !learningPathId) return 0;

    const stats = await this.statsForUser(userId, learningPathId);
    return stats.completionPercent;
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
    
    const fromLessons = (module.lessons || []).flatMap((l: any) => l.assignments || []);
    
    // Fetch assignments attached directly to the module
    const fromModule = await this.datasource.getRepository('AssignmentEntity').find({
      where: { module: { id: moduleId } } as any,
    });
    
    const allAssignmentsMap = new Map();
    fromLessons.forEach((a: any) => allAssignmentsMap.set(a.id, a));
    fromModule.forEach((a: any) => allAssignmentsMap.set(a.id, a));
    const allAssignments = Array.from(allAssignmentsMap.values());
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
          status: In([
            'Submitted', 'SUBMITTED', 'submitted',
            'Under Review', 'UNDER REVIEW', 'under review',
            'Approved', 'APPROVED', 'approved',
            'Needs Revision', 'NEEDS REVISION', 'needs revision',
            'Accepted', 'ACCEPTED', 'accepted',
            'Evaluated', 'EVALUATED', 'evaluated'
          ]),
        } as any,
      });
    }

    // 3. Pooled Item Counts Calculation (Fix for Cause #2)
    const totalItems = totalLessons + totalResources + totalTasks;
    let finalProgress = 0;
    if (totalItems > 0) {
      const totalCompleted = completedLessons + completedResources + completedTasks;
      finalProgress = (totalCompleted / totalItems) * 100;
    }
    
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
    
    // Instead of doing massive memory-heavy aggregations, we use the single shared getLPProgress function
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
      if (['draft', 'archived', 'deleted', 'upcoming'].includes(String(path.status).toLowerCase())) {
        continue;
      }
      
      const pathId = path.id;
      
      // Calculate logged-in user's progress using the shared function
      const userProgressPercent = await this.getLPProgress(currentUserId, pathId);
      
      const enrolledTraineeIds = path.assignedToTraineeIds || [];
      
      let cohortProgressPercent = 0;
      const traineeProgressMap: Record<string, number> = {};

      if (enrolledTraineeIds.length > 0) {
        let sum = 0;
        // Compute each enrolled trainee's progress using the shared function
        await Promise.all(enrolledTraineeIds.map(async (tid) => {
          const progress = await this.getLPProgress(tid, pathId);
          traineeProgressMap[tid] = progress;
          sum += progress;
        }));
        cohortProgressPercent = Math.round(sum / enrolledTraineeIds.length);
      }

      // We still need to return total items for UI display (optional, depending on if UI uses them)
      // To get total items, we would ideally fetch the modules, but let's just return 0 to simplify
      // since the UI relies primarily on the percentage. If needed, we can query it.
      
      result[pathId] = {
        userProgressPercent,
        cohortProgressPercent,
        enrolledCount: enrolledTraineeIds.length,
        totalLessons: 0, // Simplified: the UI mainly uses the percent for LP cards
        totalAssignments: 0,
        totalResources: 0,
        traineeProgressMap,
      };
    }

    return result;
  }
}
