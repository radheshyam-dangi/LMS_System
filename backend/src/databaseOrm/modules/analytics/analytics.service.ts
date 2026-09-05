import { Injectable } from '@nestjs/common';
import { DataSource, In, MoreThan, IsNull } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { EnrollmentEntity } from '../../entities/enrollment.entity';
import { EvaluationEntity } from '../../entities/evaluation.entity';
import { UserLessonProgressEntity } from '../../entities/userLessonProgress.entity';
import { UserResourceVisitEntity } from '../../entities/userResourceVisit.entity';

@Injectable()
export class AnalyticsEntityService {
  constructor(private readonly datasource: DataSource) {}

  async getDashboardStats(currentUser?: any, requestedRole?: string, traineeId?: string, trainerId?: string) {
    const userRepo = this.datasource.getRepository(UserEntity);
    const pathRepo = this.datasource.getRepository(LearningPathEntity);
    const moduleRepo = this.datasource.getRepository(ModuleEntity);
    const lessonRepo = this.datasource.getRepository(LessonEntity);
    const assignmentRepo = this.datasource.getRepository(AssignmentEntity);
    const submissionRepo = this.datasource.getRepository(
      AssignmentSubmissionEntity,
    );
    const enrollmentRepo = this.datasource.getRepository(EnrollmentEntity);
    const evaluationRepo = this.datasource.getRepository(EvaluationEntity);
    const progressRepo = this.datasource.getRepository(
      UserLessonProgressEntity,
    );
    const visitsRepo = this.datasource.getRepository(UserResourceVisitEntity);

    // If traineeId and trainerId are provided, we are in a read-only detailed trainee view scoped to a trainer.
    // In this case, we act exactly like a Trainee requesting their own dashboard, BUT scoped to the trainer's paths.
    let isTrainee = requestedRole
      ? requestedRole.toLowerCase() === 'trainee'
      : currentUser?.roles?.some(
          (r: any) => String(r.name || r).toLowerCase() === 'trainee',
        ) || currentUser?.primaryRole?.name === 'Trainee';

    let isTrainer = requestedRole
      ? requestedRole.toLowerCase() === 'trainer'
      : currentUser?.roles?.some(
          (r: any) => String(r.name || r).toLowerCase() === 'trainer',
        ) || currentUser?.primaryRole?.name === 'Trainer';

    let isAdmin = requestedRole
      ? requestedRole.toLowerCase() === 'admin'
      : currentUser?.roles?.some(
          (r: any) => String(r.name || r).toLowerCase() === 'admin',
        ) || currentUser?.primaryRole?.name === 'Admin';

    // If fetching for a specific trainee, override the effective user ID and role
    const effectiveUserId = traineeId || currentUser?.id || currentUser?.sub;
    const isTrainerScopedTraineeView = !!(traineeId && trainerId);
    
    if (isTrainerScopedTraineeView) {
      isTrainee = true;
      isTrainer = false;
      isAdmin = false;
    }

    const userId = effectiveUserId;

    const trainerExpected = 0;
    const trainerSubmitted = 0;
    const currentStreak = 0;

    const trainerTraineeIds = new Set<string>();
    if (isTrainer && !isAdmin && userId) {
      const myPaths = await pathRepo.find({
        where: { createdBy: { id: userId } },
      });
      const myPathIds = myPaths.map((p) => p.id);
      for (const p of myPaths) {
        if (p.assignedToTraineeIds)
          p.assignedToTraineeIds.forEach((id) => trainerTraineeIds.add(id));
      }

      if (myPathIds.length > 0) {
        const enrollments = await enrollmentRepo.find({
          where: { learningPath: { id: In(myPathIds) } },
          relations: ['user'],
        });
        enrollments.forEach((e) => {
          if (e.user) trainerTraineeIds.add(e.user.id);
        });
      }

      const myAssignments = await assignmentRepo.find({
        where: { createdBy: { id: userId } },
      });
      for (const a of myAssignments) {
        if (a.assignedToTraineeIds)
          a.assignedToTraineeIds.forEach((id) => trainerTraineeIds.add(id));
      }
    }

    let submissionWhereQuery: any = {};
    if (isTrainee && !isTrainer && !isAdmin && userId) {
      submissionWhereQuery = { trainee: { id: userId } };
    } else if (isTrainer && !isAdmin && userId) {
      submissionWhereQuery = [];
      if (trainerTraineeIds.size > 0) {
        submissionWhereQuery.push({
          trainee: { id: In(Array.from(trainerTraineeIds)) },
        });
      }
      submissionWhereQuery.push({ assignment: { createdBy: { id: userId } } });
      if (submissionWhereQuery.length === 0) {
        submissionWhereQuery = { trainee: { id: IsNull() } };
      }
    }

    let progressWhereQuery: any = {};
    if (isTrainee && !isTrainer && !isAdmin && userId) {
      progressWhereQuery = { user: { id: userId } };
    } else if (isTrainer && !isAdmin && userId) {
      if (trainerTraineeIds.size > 0) {
        progressWhereQuery = {
          user: { id: In(Array.from(trainerTraineeIds)) },
        };
      } else {
        progressWhereQuery = { user: { id: IsNull() } };
      }
    }

    let enrollmentWhereQuery: any = { status: 'active' };
    if (isTrainee && !isTrainer && !isAdmin && userId) {
      enrollmentWhereQuery = { status: 'active', user: { id: userId } };
    } else if (isTrainer && !isAdmin && userId) {
      if (trainerTraineeIds.size > 0) {
        enrollmentWhereQuery = { status: 'active', user: { id: In(Array.from(trainerTraineeIds)) } };
      } else {
        enrollmentWhereQuery = { status: 'active', user: { id: IsNull() } };
      }
    }

    const [
      users,
      paths,
      modules,
      totalLessons,
      allAssignments,
      pendingReviews,
      activeEnrollments,
      allSubmissions,
      evaluations,
      progressRows,
      visitRows,
      enrollments,
    ] = await Promise.all([
      userRepo.find({ relations: ['roles', 'primaryRole'] }),
      pathRepo.find({ relations: ['modules', 'createdBy'] }),
      moduleRepo.find({ relations: ['lessons', 'resources', 'learningPath'] }),
      lessonRepo.count(),
      assignmentRepo.find({
        relations: [
          'learningPath',
          'module',
          'module.learningPath',
          'lesson',
          'lesson.module',
          'lesson.module.learningPath',
          'createdBy',
        ],
      }),
      submissionRepo.count({
        where: Array.isArray(submissionWhereQuery)
          ? submissionWhereQuery.map((q) => ({ status: 'Submitted', ...q }))
          : { status: 'Submitted', ...submissionWhereQuery },
      }),
      enrollmentRepo.count({ where: enrollmentWhereQuery }),
      submissionRepo.find({
        where: submissionWhereQuery,
        relations: [
          'trainee',
          'assignment',
          'assignment.learningPath',
          'assignment.module',
        ],
        order: { submittedAt: 'DESC' },
        take: 1000,
      }),
      evaluationRepo.find({
        relations: ['submission', 'submission.user'],
        order: { createdAt: 'DESC' },
        take: 500,
      }),
      progressRepo.find({
        where: progressWhereQuery,
        relations: ['lesson', 'lesson.module', 'user'],
        take: 2000,
      }),
      visitsRepo.find({
        where: progressWhereQuery,
        relations: ['resource', 'resource.module', 'user'],
        take: 2000,
      }),
      enrollmentRepo.find({
        where: enrollmentWhereQuery,
        relations: ['learningPath', 'user'],
      }),
    ]);

    const totalAssignments = allAssignments.length;

    // Filter evaluations
    let scopedEvaluations: EvaluationEntity[] = evaluations;
    if (isTrainee && !isTrainer && !isAdmin && userId) {
      scopedEvaluations = evaluations.filter((e) => {
        const tId = (e.submission as any)?.user?.id;
        return String(tId) === String(userId);
      });
    } else if (isTrainer && !isAdmin) {
      scopedEvaluations = evaluations.filter((e) => {
        const tId = (e.submission as any)?.user?.id;
        return tId && trainerTraineeIds.has(String(tId));
      });
    }

    let totalTrainers = 0;
    let totalTrainees = 0;
    users.forEach((u) => {
      const roleNames = [
        (u as any).primaryRole?.name,
        ...(u.roles || []).map((r: any) => r.name || r),
      ]
        .filter(Boolean)
        .map((r) => String(r).toLowerCase());
      if (roleNames.includes('trainer')) totalTrainers += 1;
      if (roleNames.includes('trainee')) totalTrainees += 1;
    });

    const evaluatedSubs = allSubmissions.filter((s) =>
      ['Accepted', 'Evaluated', 'Rejected', 'Approved'].includes(String(s.status)),
    );
    const scored = evaluatedSubs
      .map((s) => Number(s.score))
      .filter((n) => Number.isFinite(n));
    const evalScores = scopedEvaluations
      .map((e) => Number(e.overallScore))
      .filter((n) => Number.isFinite(n));
    const allScores = [...scored, ...evalScores];
    // averageScore is deferred until scopedAssignmentsList is calculated

    // completionRate is deferred until scopedAssignments is calculated

    const monthBuckets = this.buildLastNMonths(6);
    const weeklyBuckets = this.buildLastNWeeks(8);

    allSubmissions.forEach((s) => {
      const when = s.submittedAt || s.createdAt;
      if (!when) return;
      const d = new Date(when);
      const mKey = `${d.getFullYear()}-${d.getMonth()}`;
      const month = monthBuckets.find((m) => m.key === mKey);
      if (month) {
        month.submissions += 1;
        if (['Accepted', 'Evaluated'].includes(String(s.status))) {
          month.completions += 1;
        }
      }

      const weekStart = this.startOfWeek(d);
      const wKey = weekStart.toISOString().slice(0, 10);
      const week = weeklyBuckets.find((w) => w.key === wKey);
      if (week) {
        week.submissions += 1;
        const score = Number(s.score);
        if (Number.isFinite(score)) {
          week.scoreSum += score;
          week.scoreCount += 1;
        }
      }
    });

    scopedEvaluations.forEach((e) => {
      const when = e.createdAt;
      if (!when) return;
      const weekStart = this.startOfWeek(new Date(when));
      const wKey = weekStart.toISOString().slice(0, 10);
      const week = weeklyBuckets.find((w) => w.key === wKey);
      if (week) {
        const score = Number(e.overallScore);
        if (Number.isFinite(score)) {
          week.scoreSum += score;
          week.scoreCount += 1;
        }
      }
    });

    const progressTrends = monthBuckets.map((m) => ({
      label: m.label,
      submissions: m.submissions,
      completions: m.completions,
    }));

    const weeklyScores = weeklyBuckets.map((w, idx) => ({
      label: `W${idx + 1}`,
      averageScore:
        w.scoreCount > 0 ? Math.round(w.scoreSum / w.scoreCount) : 0,
      submissions: w.submissions,
    }));

    let skillDistribution: any[] = [];

    // Active trainees definition for scoping
    const activeTraineeIds = users
      .filter((u) => {
        const roleNames = [
          (u as any).primaryRole?.name,
          ...(u.roles || []).map((r: any) => r.name || r),
        ]
          .filter(Boolean)
          .map((r) => String(r).toLowerCase());
        return roleNames.includes('trainee') && u.isActive !== false;
      })
      .map((u) => u.id);
    const scopedTraineesForMacro = isAdmin
      ? activeTraineeIds
      : activeTraineeIds.filter((id) => trainerTraineeIds.has(id));

    if (isTrainee && !isAdmin && !isTrainer) {
      // Trainee skill distribution: one axis per enrolled LP, score = avg(earned/max × 100)
      // Deferred until after traineeEvaluatedSubs is computed (see isTrainee block below)
      // skillDistribution will be populated in the isTrainee block
    } else {
      // Admin / Trainer skill distribution logic
      const totalScopedCount = scopedTraineesForMacro.length;
      const pathTrainees = new Map<string, Set<string>>();
      paths.forEach((p) =>
        pathTrainees.set(p.title || 'Path', new Set<string>()),
      );

      enrollments.forEach((e) => {
        const title = e.learningPath?.title || 'Unassigned';
        const uId = e.user?.id;
        if (uId && scopedTraineesForMacro.includes(uId)) {
          if (!pathTrainees.has(title))
            pathTrainees.set(title, new Set<string>());
          pathTrainees.get(title)!.add(uId);
        }
      });

      skillDistribution = [...pathTrainees.entries()].map(
        ([name, traineeSet]) => {
          const count = traineeSet.size;
          const percent =
            totalScopedCount > 0
              ? Math.round((count / totalScopedCount) * 1000) / 10
              : 0;
          return { name, count, percent };
        },
      );
    }

    const enrolledPathIds = new Set(
      enrollments.map((e) => e.learningPath?.id).filter(Boolean),
    );
    if (isTrainee && !isAdmin && !isTrainer && userId) {
      paths.forEach((p) => {
        if (p.assignedToTraineeIds && p.assignedToTraineeIds.includes(userId)) {
          enrolledPathIds.add(p.id);
        }
      });
    }

    let scopedModules = modules;
    if (isTrainee && !isAdmin && !isTrainer) {
      if (isTrainerScopedTraineeView && trainerId) {
        const myPaths = paths.filter((p) => p.createdBy?.id === trainerId).map((p) => p.id);
        const filtered = Array.from(enrolledPathIds).filter((id) => myPaths.includes(id));
        enrolledPathIds.clear();
        filtered.forEach((id) => enrolledPathIds.add(id));
      }
      if (enrolledPathIds.size > 0) {
        scopedModules = modules.filter((m) => m.learningPath?.id && enrolledPathIds.has(m.learningPath.id));
      } else {
        scopedModules = [];
      }
    }

    let scopedTotalLessons = totalLessons;
    if (isTrainee && !isAdmin && !isTrainer) {
      const lessonSet = new Set<string>();
      scopedModules.forEach((m) => {
        (m.lessons || []).forEach((l) => lessonSet.add(l.id));
      });
      scopedTotalLessons = lessonSet.size;
    }

    // Module completion from lesson progress, resources, and assignments
    const moduleCompletion = scopedModules.map((mod) => {
      const lessonIds = (mod.lessons || []).map((l) => l.id);
      const resourceIds = (mod.resources || []).map((r) => r.id);
      const modAssignments = allAssignments.filter(
        (a) => a.module?.id === mod.id || a.lesson?.module?.id === mod.id,
      );
      const assignmentIds = modAssignments.map((a) => a.id);

      const totalItemsPerUser =
        lessonIds.length + resourceIds.length + assignmentIds.length;

      const pathEnrollments = enrollments.filter(
        (e) => e.learningPath?.id === mod.learningPath?.id && e.user?.id,
      );
      let enrolledUserIds = Array.from(
        new Set(pathEnrollments.map((e) => e.user.id)),
      );

      if (isTrainee && !isAdmin && !isTrainer && userId) {
        enrolledUserIds = [userId];
      }

      let totalCompletedItems = 0;
      let sumPercents = 0;

      if (enrolledUserIds.length > 0 && totalItemsPerUser > 0) {
        for (const uid of enrolledUserIds) {
          const uLessons = new Set(
            progressRows
              .filter(
                (p) =>
                  p.user?.id === uid &&
                  p.isCompleted &&
                  lessonIds.includes(p.lesson?.id),
              )
              .map((p) => p.lesson?.id),
          ).size;
          const uResources = new Set(
            visitRows
              .filter(
                (v) =>
                  v.user?.id === uid && resourceIds.includes(v.resource?.id),
              )
              .map((v) => v.resource?.id),
          ).size;
          const uAssignments = new Set(
            allSubmissions
              .filter(
                (s) =>
                  (s.trainee?.id === uid || (s as any).traineeId === uid) &&
                  ['Accepted', 'Evaluated', 'Approved'].includes(String(s.status)) &&
                  assignmentIds.includes(s.assignment?.id),
              )
              .map((s) => s.assignment?.id),
          ).size;

          const uCompleted = uLessons + uResources + uAssignments;
          totalCompletedItems += uCompleted;
          sumPercents +=
            totalItemsPerUser > 0
              ? (uCompleted / totalItemsPerUser) * 100
              : 0;
        }
      }

      const totalExpected = enrolledUserIds.length * totalItemsPerUser;
      const percent =
        totalExpected > 0 ? (totalCompletedItems / totalExpected) * 100 : 0;

      const moduleScores = allSubmissions
        .filter(
          (s) =>
            ['Accepted', 'Evaluated', 'Approved'].includes(String(s.status)) &&
            assignmentIds.includes(s.assignment?.id) &&
            (enrolledUserIds.includes(s.trainee?.id) ||
              enrolledUserIds.includes((s as any).traineeId) ||
              enrolledUserIds.includes((s as any).user?.id)),
        )
        .map((s) => Number(s.score))
        .filter((n) => Number.isFinite(n));
      const avg =
        moduleScores.length > 0
          ? Math.round(
              moduleScores.reduce((a, b) => a + b, 0) / moduleScores.length,
            )
          : 0;

      let modLastActivity = 0;
      if (isTrainee && userId) {
         progressRows.filter(p => p.user?.id === userId && lessonIds.includes(p.lesson?.id)).forEach(p => {
             const d = new Date(p.updatedAt || p.createdAt).getTime();
             if (d > modLastActivity) modLastActivity = d;
         });
         visitRows.filter(v => v.user?.id === userId && resourceIds.includes(v.resource?.id)).forEach(v => {
             const d = new Date(v.visitedAt || v.createdAt).getTime();
             if (d > modLastActivity) modLastActivity = d;
         });
         allSubmissions.filter(s => (s.trainee?.id === userId || (s as any).traineeId === userId) && assignmentIds.includes(s.assignment?.id)).forEach(s => {
             const d = new Date(s.submittedAt || s.updatedAt || s.createdAt).getTime();
             if (d > modLastActivity) modLastActivity = d;
         });
      }

      return {
        id: mod.id,
        title: mod.title,
        pathTitle: mod.learningPath?.title || '',
        completed: totalCompletedItems,
        total: totalExpected,
        percent: Math.min(100, percent),
        averageScore: avg,
        lastActivity: modLastActivity,
      };
    });

    // Path performance bars
    let pathPerformance: any[] = [];
    if (isTrainee && !isAdmin && !isTrainer) {
      const traineePaths = enrolledPathIds.size > 0 ? paths.filter(p => enrolledPathIds.has(p.id)) : [];
      pathPerformance = traineePaths.map((p) => {
        const pathSubs = allSubmissions.filter((s) => {
          const aId = s.assignment?.id;
          const sAssignment = allAssignments.find((a) => a.id === aId);
          return (
            sAssignment?.learningPath?.id === p.id ||
            sAssignment?.module?.learningPath?.id === p.id ||
            sAssignment?.lesson?.module?.learningPath?.id === p.id
          );
        });
        const submitted = pathSubs.length;
        const completed = pathSubs.filter((s) =>
          ['Accepted', 'Evaluated', 'Approved'].includes(String(s.status)),
        );
        let sumPercents = 0;
        let gradedCount = 0;
        completed.forEach(s => {
           const aId = s.assignment?.id;
           if (aId) {
             const assignment = allAssignments.find(a => a.id === aId);
             const max = Number(assignment?.maxScore || 100);
             const earned = Number(s.score || 0);
             if (max > 0) {
               sumPercents += (earned / max) * 100;
               gradedCount++;
             }
           }
        });
        const avg = gradedCount > 0 ? Math.round(sumPercents / gradedCount) : 0;

        const pMods = moduleCompletion.filter((mc) => mc.pathTitle === p.title);
        const averageProgress =
          pMods.length > 0
            ? Math.round(
                pMods.reduce((a, b) => a + b.percent, 0) / pMods.length,
              )
            : 0;

        return {
          id: p.id,
          title: p.title,
          submitted,
          completed,
          averageScore: avg,
          averageProgress,
        };
      });
    } else {
      pathPerformance = paths.map((p) => {
        const pEnrollments = enrollments.filter(
          (e) => e.learningPath?.id === p.id && e.user?.id,
        );
        const pathTraineeIds = Array.from(
          new Set(pEnrollments.map((e) => e.user.id)),
        ).filter((id) => scopedTraineesForMacro.includes(id));

        let sumProgress = 0;
        let sumAvgScore = 0;
        let validScoreTrainees = 0;
        const traineeProgressMap: any = {};

        pathTraineeIds.forEach((tId) => {
          // Progress for this trainee
          const pMods = moduleCompletion.filter(
            (mc) => mc.pathTitle === p.title,
          );
          let tCompletedItems = 0;
          let tTotalItems = 0;

          const pModules = modules.filter((m) => m.learningPath?.id === p.id);
          pModules.forEach((mod) => {
            const lessonIds = (mod.lessons || []).map((l) => l.id);
            const resourceIds = (mod.resources || []).map((r) => r.id);
            const assignmentIds = allAssignments
              .filter(
                (a) =>
                  a.module?.id === mod.id || a.lesson?.module?.id === mod.id,
              )
              .map((a) => a.id);

            tTotalItems +=
              lessonIds.length + resourceIds.length + assignmentIds.length;

            const uLessons = new Set(
              progressRows
                .filter(
                  (pr) =>
                    pr.user?.id === tId &&
                    pr.isCompleted &&
                    lessonIds.includes(pr.lesson?.id),
                )
                .map((pr) => pr.lesson?.id),
            ).size;
            const uResources = new Set(
              visitRows
                .filter(
                  (v) =>
                    v.user?.id === tId && resourceIds.includes(v.resource?.id),
                )
                .map((v) => v.resource?.id),
            ).size;
            const uAssignments = new Set(
              allSubmissions
                .filter(
                  (s) =>
                    (s.trainee?.id === tId || (s as any).traineeId === tId) &&
                    ['Accepted', 'Evaluated'].includes(String(s.status)) &&
                    assignmentIds.includes(s.assignment?.id),
                )
                .map((s) => s.assignment?.id),
            ).size;

            tCompletedItems += uLessons + uResources + uAssignments;
          });

          const tProgressPct =
            tTotalItems > 0 ? (tCompletedItems / tTotalItems) * 100 : 0;
          sumProgress += tProgressPct;

          const tUser = users.find((u) => u.id === tId);
          const tName =
            tUser && (tUser.firstName || tUser.lastName)
              ? `${tUser.firstName || ''} ${tUser.lastName || ''}`.trim()
              : `Trainee ${String(tId).substring(0, 4)}`;
          traineeProgressMap[tName] = Math.round(tProgressPct * 10) / 10;

          // Score for this trainee in this path
          const tEvaluations = scopedEvaluations.filter((e) => {
            const eTId =
              (e.submission as any)?.trainee?.id ||
              (e.submission as any)?.traineeId ||
              (e.submission as any)?.user?.id;
            const subMatch = allSubmissions.find(
              (s) => s.id === e.submission?.id,
            );
            const aId =
              subMatch?.assignment?.id ||
              (e.submission as any)?.assignmentId ||
              e.submission?.assignment?.id;
            const eAssignment = allAssignments.find((a) => a.id === aId);
            const inPath =
              eAssignment?.learningPath?.id === p.id ||
              eAssignment?.module?.learningPath?.id === p.id ||
              eAssignment?.lesson?.module?.learningPath?.id === p.id;
            return eTId === tId && inPath;
          });

          let tEarnedScore = 0;
          let tMaxScore = 0;
          tEvaluations.forEach((e) => {
            const subMatch = allSubmissions.find(
              (s) => s.id === e.submission?.id,
            );
            const aId =
              subMatch?.assignment?.id ||
              (e.submission as any)?.assignmentId ||
              e.submission?.assignment?.id;
            const eAssignment = allAssignments.find((a) => a.id === aId);

            const eMaxScore = Number(eAssignment?.maxScore || 100);
            const eScore = Number(
              e.overallScore || (e.submission as any)?.score || 0,
            );
            if (Number.isFinite(eScore)) {
              tEarnedScore += eScore;
              tMaxScore += eMaxScore;
            }
          });

          if (tMaxScore > 0) {
            sumAvgScore += (tEarnedScore / tMaxScore) * 100;
            validScoreTrainees++;
          }
        });

        const pAverageProgress =
          pathTraineeIds.length > 0
            ? Math.round((sumProgress / pathTraineeIds.length) * 10) / 10
            : 0;
        const pAverageScore =
          validScoreTrainees > 0
            ? Math.round((sumAvgScore / validScoreTrainees) * 10) / 10
            : 0;

        const pathSubs = allSubmissions.filter((s) => {
          const sAssignment = allAssignments.find(
            (a) => a.id === s.assignment?.id,
          );
          return (
            sAssignment?.learningPath?.id === p.id ||
            sAssignment?.module?.learningPath?.id === p.id ||
            sAssignment?.lesson?.module?.learningPath?.id === p.id
          );
        });

        return {
          id: p.id,
          title: p.title,
          submitted: pathSubs.length,
          completed: pathSubs.filter((s) =>
            ['Accepted', 'Evaluated'].includes(String(s.status)),
          ).length,
          averageScore: pAverageScore,
          averageProgress: pAverageProgress,
          ...traineeProgressMap,
        };
      });
    }

    const previousMonth = progressTrends[progressTrends.length - 2];
    const currentMonth = progressTrends[progressTrends.length - 1];
    const completionGrowth =
      previousMonth && previousMonth.completions > 0
        ? Math.round(
            ((currentMonth.completions - previousMonth.completions) /
              previousMonth.completions) *
              100,
          )
        : currentMonth?.completions
          ? 100
          : 0;

    const recentActivity = allSubmissions.slice(0, 8);

    const scopedTrainees =
      isTrainer && !isAdmin
        ? trainerTraineeIds.size
        : isTrainee && !isAdmin
          ? 1
          : totalTrainees;

    let scopedAssignmentsList = allAssignments;
    if (isTrainee && !isAdmin && userId) {
      scopedAssignmentsList = allAssignments.filter((a) => {
        const inPath =
          a.learningPath?.id && enrolledPathIds.has(a.learningPath.id);
        const inModule =
          a.module?.learningPath?.id &&
          enrolledPathIds.has(a.module.learningPath.id);
        const inLesson =
          a.lesson?.module?.learningPath?.id &&
          enrolledPathIds.has(a.lesson.module.learningPath.id);
        const isDirect =
          Array.isArray(a.assignedToTraineeIds) &&
          a.assignedToTraineeIds.includes(userId) &&
          (!isTrainerScopedTraineeView || !trainerId || a.createdBy?.id === trainerId);
        return inPath || inModule || inLesson || isDirect;
      });
    } else if (isTrainer && !isAdmin) {
      scopedAssignmentsList = allAssignments.filter(
        (a) => a.createdBy?.id === userId,
      ); // mock for trainer
    }

    const scopedAssignments = scopedAssignmentsList.length;

    const scopedPendingReviews =
      isTrainer && !isAdmin
        ? allSubmissions.filter((s) => s.status === 'Submitted').length
        : pendingReviews;

    // completionRate is deferred until actualTasksCompleted is calculated

    // Trainee Progress List for Trainers and Admins
    const assignedTraineesProgress: any[] = [];
    if (isAdmin || isTrainer) {
      const activeTraineeUsers = users.filter((u) => {
        const roleNames = [
          (u as any).primaryRole?.name,
          ...(u.roles || []).map((r: any) => r.name || r),
        ].filter(Boolean).map((r) => String(r).toLowerCase());
        return roleNames.includes('trainee') && !u.deletedAt && u.isActive !== false;
      });
      
      const targetTrainees = isAdmin ? activeTraineeUsers : activeTraineeUsers.filter(u => trainerTraineeIds.has(u.id));

      targetTrainees.forEach(tUser => {
        const tId = tUser.id;
        const tName = `${tUser.firstName || ''} ${tUser.lastName || ''}`.trim() || tUser.email || `Trainee ${String(tId).substring(0, 4)}`;
        
        const tEnrollments = enrollments.filter(e => e.user?.id === tId && e.learningPath?.id);
        const tEnrolledPathIds = new Set(tEnrollments.map(e => e.learningPath.id));
        
        let expectedLessons = 0;
        let expectedResources = 0;
        const tModules = modules.filter(m => m.learningPath?.id && tEnrolledPathIds.has(m.learningPath.id));
        tModules.forEach(mod => {
           expectedLessons += (mod.lessons || []).length;
           expectedResources += (mod.resources || []).length;
        });
        
        const tAssignments = allAssignments.filter(a => {
           const inPath = a.learningPath?.id && tEnrolledPathIds.has(a.learningPath.id);
           const inModule = a.module?.learningPath?.id && tEnrolledPathIds.has(a.module.learningPath.id);
           const inLesson = a.lesson?.module?.learningPath?.id && tEnrolledPathIds.has(a.lesson.module.learningPath.id);
           const isDirect = Array.isArray(a.assignedToTraineeIds) && a.assignedToTraineeIds.includes(tId);
           return inPath || inModule || inLesson || isDirect;
        });
        const expectedAssignments = tAssignments.length;
        const totalExpected = expectedLessons + expectedResources + expectedAssignments;
        
        const tLessonsCompleted = new Set(progressRows.filter(p => p.user?.id === tId && p.isCompleted).map(p => p.lesson?.id)).size;
        const tResourcesVisited = new Set(visitRows.filter(v => v.user?.id === tId).map(v => v.resource?.id)).size;
        const tCompletedSubs = allSubmissions.filter(s => 
           (s.trainee?.id === tId || (s as any).traineeId === tId || (s as any).user?.id === tId) && 
           ['Accepted', 'Evaluated', 'Approved'].includes(String(s.status)) &&
           tAssignments.some(a => a.id === s.assignment?.id)
        );
        const tAssignmentsCompleted = tCompletedSubs.filter(s => String(s.status) === 'Approved').length;
        
        const totalCompleted = tLessonsCompleted + tResourcesVisited + tAssignmentsCompleted;
        const progressPercent = totalExpected > 0 ? (totalCompleted / totalExpected) * 100 : 0;
        
        let tEarnedScore = 0;
        let tMaxScore = 0;
        
        tCompletedSubs.forEach(s => {
          const sAssignment = tAssignments.find(a => a.id === s.assignment?.id);
          if (sAssignment) {
            const sMaxScore = Number(sAssignment.maxScore || 100);
            const sScore = Number(s.score || 0);
            if (Number.isFinite(sScore)) {
              tEarnedScore += sScore;
              tMaxScore += sMaxScore;
            }
          }
        });
        
        const tEvaluations = scopedEvaluations.filter(e => {
          const eTraineeId = (e.submission as any)?.user?.id || (e.submission as any)?.trainee?.id;
          return String(eTraineeId) === String(tId) && tCompletedSubs.some(s => s.id === e.submission?.id);
        });

        tEvaluations.forEach(e => {
          const eMaxScore = 100;
          const eScore = Number(e.overallScore || 0);
          if (Number.isFinite(eScore)) {
            tEarnedScore += eScore;
            tMaxScore += eMaxScore;
          }
        });

        const avgScore = tMaxScore > 0 ? (tEarnedScore / tMaxScore) * 100 : 0;

        assignedTraineesProgress.push({
          traineeId: tId,
          traineeName: tName,
          status: (tUser as any).status || 'Active',
          progressPercent: Math.round(progressPercent),
          avgScore: Math.round(avgScore),
          // for compatibility with older frontend code that used traineeProgressList
          completed: totalCompleted,
          remaining: Math.max(0, totalExpected - totalCompleted),
          progress: Math.round(progressPercent),
          name: tName,
        });
      });
      
      assignedTraineesProgress.sort((a, b) => b.progressPercent - a.progressPercent);
    }
    const traineeProgressList = assignedTraineesProgress;

    // Real Stats Calculations
    const nowMs = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Tasks completed: count assignments where trainee submitted (any status except not-started/in-progress)
    const scopedAssignmentIds = new Set(scopedAssignmentsList.map((a) => a.id));
    const submittedAssignmentIds = new Set<string>();
    const submittedStatuses = ['submitted', 'rejected', 'accepted', 'evaluated', 'approved', 'under review', 'needs revision'];
    allSubmissions.forEach((s) => {
      if (
        submittedStatuses.includes(String(s.status).toLowerCase()) &&
        s.assignment?.id &&
        scopedAssignmentIds.has(s.assignment.id)
      ) {
        submittedAssignmentIds.add(s.assignment.id);
      }
    });
    const actualTasksCompleted = submittedAssignmentIds.size;

    const draftLpsCount = paths.filter(p => String(p.status).toUpperCase() === 'DRAFT').length;

    // Default calculations (will be overridden for Admin/Trainer)
    let completionRate =
      scopedAssignments > 0
        ? Math.round((actualTasksCompleted / scopedAssignments) * 100)
        : 0;
    let averageScore = 0;

    // Learning velocity (last 7 days activity)
    const sevenDaysAgo = nowMs - (7 * dayMs);
    const recent7dProgressCount = progressRows.filter(
      (p) =>
        p.user?.id === userId &&
        p.isCompleted &&
        new Date(p.updatedAt || p.createdAt).getTime() >= sevenDaysAgo,
    ).length;

    const recent7dVisitsCount = visitRows.filter(
      (v) =>
        v.user?.id === userId &&
        new Date(v.visitedAt || v.createdAt).getTime() >= sevenDaysAgo,
    ).length;
    
    const recent7dTasksCount = allSubmissions.filter(s => {
        const tId = s.trainee?.id || (s as any).traineeId || (s as any).user?.id;
        const sStatus = String(s.status || '').toLowerCase();
        return String(tId) === String(userId) && ['submitted', 'accepted', 'evaluated', 'approved', 'under review'].includes(sStatus) && new Date(s.submittedAt || s.createdAt).getTime() >= sevenDaysAgo;
    }).length;
    
    const learningVelocity = recent7dProgressCount + recent7dVisitsCount + recent7dTasksCount;

    let skillGrowth = 0;
    
    // Trainee-specific accurate scoring & skills
    let traineeTotalGainedScore = 0;
    let traineeTotalMaxScore = 0;
    // averageScore is already declared at the top of the function
    const bestScoreByAssignment = new Map<string, { score: number, max: number }>();

    if (isTrainee) {
      // 1. Avg Score Logic
      const traineeEvaluatedSubs = allSubmissions.filter(s => {
        const sTraineeId = s.trainee?.id || (s as any).traineeId || (s as any).user?.id;
        const sStatus = String(s.status).toLowerCase();
        const matchesUserAndStatus = String(sTraineeId) === String(userId) && (
          ['accepted', 'evaluated', 'approved'].includes(sStatus) ||
          s.score !== null
        );
        return isTrainerScopedTraineeView 
          ? matchesUserAndStatus && s.assignment?.id && scopedAssignmentIds.has(s.assignment.id)
          : matchesUserAndStatus;
      });

      console.log(`[DEBUG] userId: ${userId}, traineeEvaluatedSubs length: ${traineeEvaluatedSubs.length}`);

      traineeEvaluatedSubs.forEach(s => {
        const aId = s.assignment?.id;
        if (aId) {
          const currentBest = bestScoreByAssignment.get(aId)?.score || -1;
          const sScore = Number(s.score || 0);
          if (sScore > currentBest) {
             const assignment = allAssignments.find(a => a.id === aId);
             bestScoreByAssignment.set(aId, { score: sScore, max: Number(assignment?.maxScore || 100) });
          }
        }
      });
      
      const gradedItems = Array.from(bestScoreByAssignment.values());
      traineeTotalGainedScore = gradedItems.reduce((acc, val) => acc + val.score, 0);
      traineeTotalMaxScore = gradedItems.reduce((acc, val) => acc + val.max, 0);
      console.log(`[DEBUG] gained: ${traineeTotalGainedScore}, max: ${traineeTotalMaxScore}`);
      
      averageScore = traineeTotalMaxScore > 0 
          ? Math.round((traineeTotalGainedScore / traineeTotalMaxScore) * 100) 
          : 0;

      // 2. Skill Growth Logic (per-LP based, 30-day trailing comparison)
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now - thirtyDaysMs;
      
      let sumGrowth = 0;
      let pathsWithGrowth = 0;

      // 2b. Build LP-based skillDistribution (radar chart: one axis per LP)
      const enrolledLpIds = Array.from(enrolledPathIds);
      const enrolledLps = paths.filter(p => enrolledLpIds.includes(p.id));

      enrolledLps.forEach(lp => {
        const lpId = lp.id;
        // Find all assignments belonging to this LP
        const lpAssignments = scopedAssignmentsList.filter(a =>
          (a.learningPath?.id === lpId) ||
          (a.module?.learningPath?.id === lpId) ||
          (a.lesson?.module?.learningPath?.id === lpId)
        );

        let lpEarned = 0;
        let lpMax = 0;
        let recentEarned = 0;
        let recentMax = 0;
        let oldEarned = 0;
        let oldMax = 0;
        let gradedCount = 0;

        lpAssignments.forEach(task => {
          const subsForTask = traineeEvaluatedSubs.filter(s => s.assignment?.id === task.id);
          if (subsForTask.length > 0) {
            const bestSub = subsForTask.reduce((best, current) => Number(current.score || 0) > Number(best.score || 0) ? current : best);
            const subTime = new Date(bestSub.submittedAt || bestSub.createdAt).getTime();
            const sScore = Number(bestSub.score || 0);
            const sMax = Number(task.maxScore || 100);

            lpEarned += sScore;
            lpMax += sMax;
            gradedCount++;

            if (subTime >= thirtyDaysAgo) {
              recentEarned += sScore;
              recentMax += sMax;
            } else {
              oldEarned += sScore;
              oldMax += sMax;
            }
          }
        });

        // Per-LP score = avg(earned/max × 100) across graded items
        const lpPercent = lpMax > 0 ? Math.round((lpEarned / lpMax) * 100 * 100) / 100 : 0;
        skillDistribution.push({ name: lp.title || 'Unknown Path', count: gradedCount, percent: lpPercent });

        // Growth calculation for this LP
        if (oldMax > 0 || recentMax > 0) {
          const oldScore = oldMax > 0 ? (oldEarned / oldMax) * 100 : 0;
          const recentScore = recentMax > 0 ? (recentEarned / recentMax) * 100 : 0;

          if (oldMax > 0 && oldScore > 0) {
            const growth = ((recentScore - oldScore) / oldScore) * 100;
            if (Number.isFinite(growth)) {
              sumGrowth += growth;
              pathsWithGrowth++;
            }
          } else if (recentMax > 0) {
            // All graded data is recent — treat recentScore as absolute gain
            sumGrowth += recentScore;
            pathsWithGrowth++;
          }
        }
      });

      // If no enrolled LPs at all, add a placeholder for the radar chart
      if (skillDistribution.length === 0) {
        skillDistribution.push({ name: 'No paths assigned', count: 0, percent: 0 });
      }

      if (pathsWithGrowth > 0) {
        skillGrowth = Math.round((sumGrowth / pathsWithGrowth) * 100) / 100;
      }
    } else {
       if (moduleCompletion.length > 0) {
         const totalExpectedAcrossModules = moduleCompletion.reduce(
           (acc, m) => acc + m.total,
           0,
         );
         const totalCompletedAcrossModules = moduleCompletion.reduce(
           (acc, m) => acc + m.completed,
           0,
         );
         if (totalExpectedAcrossModules > 0) {
           skillGrowth = Math.round(
             (totalCompletedAcrossModules / totalExpectedAcrossModules) * 100,
           );
         }
       }
    }

    const totalMaxScore = isTrainee ? traineeTotalMaxScore : (scopedAssignmentsList.length > 0 ? scopedAssignmentsList.reduce((acc, a) => acc + (a.maxScore || 100), 0) : 100);
    const totalGainedScore = isTrainee ? traineeTotalGainedScore : allScores.reduce((a, b) => a + b, 0);
    
    if (!isTrainee) {
      averageScore = totalMaxScore > 0 ? Math.round((totalGainedScore / totalMaxScore) * 100) : 0;
    }

    let trainingEffectiveness = Math.round(
      averageScore * 0.5 + completionRate * 0.5,
    );

    // Macro-averaging logic for Trainer and Admin roles
    if (!isTrainee || isTrainer || isAdmin) {
      let sumHealth = 0;
      let sumCompletionRate = 0;
      let sumAvgScore = 0;
      let validTrainees = 0;

      const activeTraineeIds = users
        .filter((u) => {
          const roleNames = [
            (u as any).primaryRole?.name,
            ...(u.roles || []).map((r: any) => r.name || r),
          ]
            .filter(Boolean)
            .map((r) => String(r).toLowerCase());
          return roleNames.includes('trainee') && u.isActive !== false;
        })
        .map((u) => u.id);

      const scopedTraineesForMacro = isAdmin
        ? activeTraineeIds
        : activeTraineeIds.filter((id) => trainerTraineeIds.has(id));

      scopedTraineesForMacro.forEach((tId) => {
        // Count all assigned tasks for tId
        const tEnrolledPathIds = new Set(
          enrollments
            .filter((e) => e.user?.id === tId && e.learningPath?.id)
            .map((e) => e.learningPath.id),
        );
        const tAssignments = allAssignments.filter((a) => {
          const inPath =
            a.learningPath?.id && tEnrolledPathIds.has(a.learningPath.id);
          const inModule =
            a.module?.learningPath?.id &&
            tEnrolledPathIds.has(a.module.learningPath.id);
          const inLesson =
            a.lesson?.module?.learningPath?.id &&
            tEnrolledPathIds.has(a.lesson.module.learningPath.id);
          const isDirect =
            Array.isArray(a.assignedToTraineeIds) &&
            a.assignedToTraineeIds.includes(tId);
          return inPath || inModule || inLesson || isDirect;
        });
        const tAssignmentsCount = tAssignments.length;

        // Count completed submissions
        const tCompletedSubs = allSubmissions.filter((s) => {
          const sTraineeId =
            s.trainee?.id || (s as any).traineeId || (s as any).user?.id;
          return (
            sTraineeId === tId &&
            ['Accepted', 'Evaluated'].includes(String(s.status))
          );
        });
        const tCompletedCount = tCompletedSubs.length;

        const tCompletionRate =
          tAssignmentsCount > 0
            ? (tCompletedCount / tAssignmentsCount) * 100
            : 0;

        // Calculate Score based on assignments and evaluations for this trainee
        let tEarnedScore = 0;
        let tMaxScore = 0;

        tCompletedSubs.forEach((s) => {
          const sAssignment = allAssignments.find(
            (a) => a.id === s.assignment?.id,
          );
          if (sAssignment) {
            const sMaxScore = Number(sAssignment.maxScore || 100);
            const sScore = Number(s.score || 0);
            if (Number.isFinite(sScore)) {
              tEarnedScore += sScore;
              tMaxScore += sMaxScore;
            }
          }
        });

        const tEvaluations = scopedEvaluations.filter((e) => {
          const eTraineeId = (e.submission as any)?.user?.id;
          return String(eTraineeId) === String(tId);
        });

        tEvaluations.forEach((e) => {
          const eMaxScore = 100; // Legacy evaluations default to 100
          const eScore = Number(e.overallScore || 0);
          if (Number.isFinite(eScore)) {
            tEarnedScore += eScore;
            tMaxScore += eMaxScore;
          }
        });

        const tAvgScore = tMaxScore > 0 ? (tEarnedScore / tMaxScore) * 100 : 0;
        const tHealth = tCompletionRate * 0.5 + tAvgScore * 0.5;

        sumCompletionRate += tCompletionRate;
        sumAvgScore += tAvgScore;
        sumHealth += tHealth;
        validTrainees++;
      });

      if (validTrainees > 0) {
        completionRate =
          Math.round((sumCompletionRate / validTrainees) * 10) / 10;
        averageScore = Math.round((sumAvgScore / validTrainees) * 10) / 10;
        trainingEffectiveness =
          Math.round((sumHealth / validTrainees) * 10) / 10;
      } else {
        completionRate = 0;
        averageScore = 0;
        trainingEffectiveness = 0;
      }
    }

    // Cumulative Path Progression for Line Chart
    const pathProgression: any[] = [];
    const maxModulesInPath =
      paths.length > 0
        ? Math.max(
            ...paths.map(
              (p) => modules.filter((m) => m.learningPath?.id === p.id).length,
            ),
          )
        : 0;

    for (let i = 0; i <= maxModulesInPath; i++) {
      const step: any = { sequence: i === 0 ? 'Start' : `Module ${i}` };

      paths.forEach((p) => {
        const pMods = modules
          .filter((m) => m.learningPath?.id === p.id)
          .sort((a, b) => {
            const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return da - db;
          });
        if (pMods.length === 0) return;

        const totalPathLessons = pMods.reduce(
          (sum, m) => sum + (m.lessons?.length || 0),
          0,
        );

        if (i === 0) {
          step[p.title] = 0;
          step[`${p.title}_name`] = 'Enrolled';
          return;
        }

        let cumulatedCompleted = 0;
        for (let j = 0; j < i; j++) {
          if (j < pMods.length) {
            const mod = pMods[j];
            const modStats = moduleCompletion.find((mc) => mc.id === mod.id);
            if (modStats) cumulatedCompleted += modStats.completed;
          }
        }

        const percent =
          totalPathLessons > 0
            ? Math.min(
                100,
                Math.round((cumulatedCompleted / totalPathLessons) * 100),
              )
            : 0;
        step[p.title] = percent;
        if (i - 1 < pMods.length) {
          step[`${p.title}_name`] = pMods[i - 1].title;
        } else {
          step[`${p.title}_name`] = 'Finished';
        }
      });
      pathProgression.push(step);
    }

    const activityTimestamps: string[] = [];
    allSubmissions.forEach((s) => {
      if (s.submittedAt || s.createdAt)
        activityTimestamps.push(
          new Date(s.submittedAt || s.createdAt).toISOString(),
        );
    });
    progressRows.forEach((p) => {
      if (p.completedAt || p.createdAt)
        activityTimestamps.push(
          new Date(p.completedAt || p.createdAt).toISOString(),
        );
    });
    visitRows.forEach((v) => {
      if (v.visitedAt || v.createdAt)
        activityTimestamps.push(
          new Date(v.visitedAt || v.createdAt).toISOString(),
        );
    });


    const trainerLpsCreated = paths.filter(p => p.createdBy?.id === userId).length;
    const myAllAssignments = allAssignments.filter(a => a.createdBy?.id === userId);
    const trainerAssignments = {
      total: myAllAssignments.length,
      internal: myAllAssignments.filter(a => !a.isExternal && (a.learningPath || a.module || a.lesson)).length,
      external: myAllAssignments.filter(a => a.isExternal || (!a.learningPath && !a.module && !a.lesson)).length
    };
    
    // Pending Reviews for Admin uses platform-wide pending, for Trainer it's scoped.
    const trainerPendingReviews = allSubmissions.filter(s => 
      s.status === 'Submitted' && 
      (s.assignment?.createdBy?.id === userId || Array.from(trainerTraineeIds).includes(s.trainee?.id)) // Spec uses "assigner" which roughly aligns to trainerTraineeIds
    ).length;


    return {
      platformTotalTrainees: totalTrainees,
      platformTotalTrainers: totalTrainers,
      trainerLpsCreated,
      trainerAssignments,
      trainerPendingReviews,
      assignedTraineesProgress,
      totalUsers: users.length,
      totalTrainers,
      totalTrainees: scopedTrainees,
      totalPaths: paths.length,
      totalModules: modules.length,
      totalLessons: scopedTotalLessons,
      totalAssignments: scopedAssignments,
      pendingReviews: scopedPendingReviews,
      completionRate,
      averageScore,
      activeEnrollments:
        isTrainee && !isAdmin && !isTrainer
          ? enrolledPathIds.size
          : activeEnrollments,
      completionGrowth,
      recentActivity,
      tasksCompleted: actualTasksCompleted,
      learningVelocity: learningVelocity,
      currentStreak: currentUser?.lastCelebratedStreak || 0,
      trainingEffectiveness: Math.round(
        averageScore * 0.5 + completionRate * 0.5,
      ),
      totalGainedScore,
      totalMaxScore,
      skillGrowth,
      activityTimestamps,
      charts: {
        progressTrends,
        weeklyScores,
        skillDistribution,
        moduleCompletion,
        pathPerformance,
        traineeProgressList,
        pathProgression,
      },
    };
  }

  private buildLastNMonths(n: number) {
    const now = new Date();
    const months: {
      key: string;
      label: string;
      submissions: number;
      completions: number;
    }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString('en', { month: 'short' }),
        submissions: 0,
        completions: 0,
      });
    }
    return months;
  }

  private buildLastNWeeks(n: number) {
    const weeks: {
      key: string;
      submissions: number;
      scoreSum: number;
      scoreCount: number;
    }[] = [];
    const now = this.startOfWeek(new Date());
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      weeks.push({
        key: d.toISOString().slice(0, 10),
        submissions: 0,
        scoreSum: 0,
        scoreCount: 0,
      });
    }
    return weeks;
  }

  private startOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day + 6) % 7; // Monday start
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - diff);
    return d;
  }

  async updateLastCelebratedStreak(currentUser: any, streak: number) {
    if (!currentUser?.id && !currentUser?.sub) return { success: false };
    const userId = currentUser.id || currentUser.sub;
    const userRepo = this.datasource.getRepository(UserEntity);
    await userRepo.update(userId, { lastCelebratedStreak: streak });
    return { success: true, lastCelebratedStreak: streak };
  }

  async getDailyChartData(
    currentUser: any,
    range: number,
    role: string,
    type: 'progress' | 'score',
    filter?: string,
    customStartDate?: string,
    customEndDate?: string
  ) {
    const submissionRepo = this.datasource.getRepository(
      AssignmentSubmissionEntity,
    );
    const assignmentRepo = this.datasource.getRepository(AssignmentEntity);
    const pathRepo = this.datasource.getRepository(LearningPathEntity);
    const enrollmentRepo = this.datasource.getRepository(EnrollmentEntity);

    const userId = currentUser?.id || currentUser?.sub;
    const isTrainerScope = role === 'trainer' && userId;

    let submissionWhereQuery: any = {};
    const trainerTraineeIds = new Set<string>();

    if (role.toLowerCase() === 'trainee' && userId) {
      submissionWhereQuery = { trainee: { id: userId } };
    } else if (isTrainerScope) {
      const myPaths = await pathRepo.find({
        where: { createdBy: { id: userId } },
      });
      const myPathIds = myPaths.map((p) => p.id);
      for (const p of myPaths) {
        if (p.assignedToTraineeIds)
          p.assignedToTraineeIds.forEach((id) => trainerTraineeIds.add(id));
      }

      if (myPathIds.length > 0) {
        const enrollments = await enrollmentRepo.find({
          where: { learningPath: { id: In(myPathIds) } },
          relations: ['user'],
        });
        enrollments.forEach((e) => {
          if (e.user) trainerTraineeIds.add(e.user.id);
        });
      }

      const myAssignments = await assignmentRepo.find({
        where: { createdBy: { id: userId } },
      });
      for (const a of myAssignments) {
        if (a.assignedToTraineeIds)
          a.assignedToTraineeIds.forEach((id) => trainerTraineeIds.add(id));
      }

      submissionWhereQuery = [];
      if (trainerTraineeIds.size > 0) {
        submissionWhereQuery.push({
          trainee: { id: In(Array.from(trainerTraineeIds)) },
        });
      }
      submissionWhereQuery.push({ assignment: { createdBy: { id: userId } } });

      if (submissionWhereQuery.length === 0) {
        submissionWhereQuery = { trainee: { id: IsNull() } };
      }
    }

    let finalStartDate = new Date();
    let finalEndDate = new Date();
    let bucketType: 'day' = 'day';

    if (filter === 'custom' && customStartDate && customEndDate) {
      finalStartDate = new Date(customStartDate);
      finalStartDate.setHours(0, 0, 0, 0);
      finalEndDate = new Date(customEndDate);
      finalEndDate.setHours(23, 59, 59, 999);
    } else {
      finalStartDate.setDate(finalStartDate.getDate() - range + 1);
      finalStartDate.setHours(0, 0, 0, 0);
      finalEndDate.setHours(23, 59, 59, 999);
    }

    const startDate = finalStartDate;
    const endDate = finalEndDate;

    const createBucket = (iso: string, name: string) => ({
      date: iso,
      name: name,
      submissions: 0,
      completions: 0,
      traineeScores: {} as { [traineeId: string]: { scoreSum: number; maxScoreSum: number } },
      activitySets: {
        lessons: new Set<string>(),
        tasks: new Set<string>(),
        resources: new Set<string>(),
      }
    });

    const getIsoKey = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const days: { [key: string]: ReturnType<typeof createBucket> } = {};

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysCount = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
    for (let i = 0; i <= daysCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      if (d > endDate) break;
      const iso = getIsoKey(d);
      const name = d.toLocaleString('en', { month: 'short', day: 'numeric' });
      days[iso] = createBucket(iso, name);
    }

    let progressRows: any[] = [];
    let visitRows: any[] = [];
    if (role.toLowerCase() === 'trainee' && userId && type === 'score') {
      const progressRepo = this.datasource.getRepository(UserLessonProgressEntity);
      const visitsRepo = this.datasource.getRepository(UserResourceVisitEntity);
      progressRows = await progressRepo.find({
        where: { user: { id: userId }, updatedAt: MoreThan(startDate) as any },
        relations: ['lesson']
      });
      visitRows = await visitsRepo.find({
        where: { user: { id: userId }, visitedAt: MoreThan(startDate) as any },
        relations: ['resource']
      });

      for (const p of progressRows) {
        const d = new Date(p.updatedAt || p.createdAt);
        if (d >= startDate && d <= endDate) {
          const isoKey = getIsoKey(d);
          if (days[isoKey] && p.lesson?.id) days[isoKey].activitySets.lessons.add(p.lesson.id);
        }
      }

      for (const v of visitRows) {
        const d = new Date(v.visitedAt || v.createdAt);
        if (d >= startDate && d <= endDate) {
          const isoKey = getIsoKey(d);
          if (days[isoKey] && v.resource?.id) days[isoKey].activitySets.resources.add(v.resource.id);
        }
      }
    }

    const allSubmissions = await submissionRepo.find({
      where: submissionWhereQuery,
      relations: ['trainee', 'assignment'],
    });

    for (const sub of allSubmissions) {
      const dateVal = sub.submittedAt || sub.createdAt || sub.updatedAt;
      if (!dateVal) continue;
      const subDate = new Date(dateVal);
      if (subDate >= startDate && subDate <= endDate) {
        const isoKey = getIsoKey(subDate);
        if (days[isoKey]) {
          days[isoKey].submissions += 1;

          if (role.toLowerCase() === 'trainee' && type === 'score' && sub.assignment?.id) {
            days[isoKey].activitySets.tasks.add(sub.assignment.id);
          }

          if (['accepted', 'evaluated', 'approved', 'submitted', 'under review'].includes(String(sub.status).toLowerCase())) {
            days[isoKey].completions += 1;
            const score = Number(sub.score);
            const maxScore = Number(sub.assignment?.maxScore || 100);
            const tId = sub.trainee?.id || (sub as any).traineeId || 'unknown';
            if (Number.isFinite(score)) {
              if (!days[isoKey].traineeScores[tId]) {
                days[isoKey].traineeScores[tId] = {
                  scoreSum: 0,
                  maxScoreSum: 0,
                };
              }
              days[isoKey].traineeScores[tId].scoreSum += score;
              days[isoKey].traineeScores[tId].maxScoreSum += maxScore;
            }
          }
        }
      }
    }

    const data = Object.values(days).map((d) => {
      let dailyScore: number | null = null;
      let lessons = 0;
      let tasks = 0;
      let resources = 0;
      
      if (role.toLowerCase() === 'trainee' && type === 'score') {
        lessons = d.activitySets.lessons.size;
        tasks = d.activitySets.tasks.size;
        resources = d.activitySets.resources.size;
        
        const DAILY_CAP = 10;
        dailyScore = Math.min(100, Math.round(((lessons + tasks + resources) / DAILY_CAP) * 100));
      } else {
        const traineeIds = Object.keys(d.traineeScores);
        if (traineeIds.length > 0) {
          let sumTraineePct = 0;
          for (const tId of traineeIds) {
            const { scoreSum, maxScoreSum } = d.traineeScores[tId];
            if (maxScoreSum > 0) {
              sumTraineePct += (scoreSum / maxScoreSum) * 100;
            }
          }
          dailyScore = Math.round((sumTraineePct / traineeIds.length) * 10) / 10;
        } else {
          dailyScore = 0;
        }
      }

      return {
        name: d.name,
        date: d.date,
        submissions: d.submissions,
        completions: d.completions,
        score: dailyScore,
        lessons,
        tasks,
        resources
      };
    });

    return {
      range,
      scope:
        role.toLowerCase() === 'trainee'
          ? `trainee:${userId}`
          : isTrainerScope
            ? `trainer:${userId}`
            : 'admin:all',
      data,
    };
  }

  async getTrainerDashboardSummary(currentUser: any) {
    const userId = currentUser.id || currentUser.sub;

    const userRepo = this.datasource.getRepository(UserEntity);
    const pathRepo = this.datasource.getRepository(LearningPathEntity);
    const assignmentRepo = this.datasource.getRepository(AssignmentEntity);
    const enrollmentRepo = this.datasource.getRepository(EnrollmentEntity);
    const submissionRepo = this.datasource.getRepository(AssignmentSubmissionEntity);
    const evaluationRepo = this.datasource.getRepository(EvaluationEntity);

    // 1. Platform Totals
    const platformTotalTrainees = await this.datasource.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM "User" u
      JOIN "UserRoles" ur ON u.id = ur."userId"
      JOIN "Role" r ON ur."roleId" = r.id
      WHERE r.name = 'Trainee'
    `).then(res => parseInt(res[0].count, 10));

    const platformTotalTrainers = await this.datasource.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM "User" u
      JOIN "UserRoles" ur ON u.id = ur."userId"
      JOIN "Role" r ON ur."roleId" = r.id
      WHERE r.name = 'Trainer'
    `).then(res => parseInt(res[0].count, 10));

    // 2. LPs Created
    const myPaths = await pathRepo.find({
      where: { createdBy: { id: userId } }
    });
    const trainerLpsCreated = myPaths.length;
    const myPathIds = myPaths.map(p => p.id);

    // 3. Assignments Created (Internal/External)
    const myAssignments = await assignmentRepo.find({
      where: { createdBy: { id: userId } },
      relations: ['learningPath', 'module', 'lesson']
    });
    
    const trainerAssignments = {
      total: myAssignments.length,
      internal: myAssignments.filter(a => !a.isExternal && (a.learningPath || a.module || a.lesson)).length,
      external: myAssignments.filter(a => a.isExternal || (!a.learningPath && !a.module && !a.lesson)).length
    };

    // 4. My Trainees (Distinct trainees assigned)
    const trainerTraineeIds = new Set<string>();
    
    for (const p of myPaths) {
      if (p.assignedToTraineeIds) p.assignedToTraineeIds.forEach(id => trainerTraineeIds.add(id));
    }
    
    if (myPathIds.length > 0) {
      const enrollments = await enrollmentRepo.find({
        where: { learningPath: { id: In(myPathIds) } },
        relations: ['user', 'learningPath']
      });
      enrollments.forEach(e => {
        if (e.user) trainerTraineeIds.add(e.user.id);
      });
    }

    for (const a of myAssignments) {
      if (a.assignedToTraineeIds) a.assignedToTraineeIds.forEach(id => trainerTraineeIds.add(id));
    }

    const myTraineesCount = trainerTraineeIds.size;
    
    // 5. Pending Reviews
    const trainerPendingReviews = await submissionRepo.count({
      where: [
        { status: 'Submitted', assignment: { createdBy: { id: userId } } },
        { status: 'Submitted', trainee: { id: In(Array.from(trainerTraineeIds)) } }
      ]
    });

    // 6. Assigned LPs & Trainee Progress
    const assignedTraineesProgress: any[] = [];
    let sumCompletionRate = 0;
    let sumAvgScore = 0;

    if (trainerTraineeIds.size > 0) {
      const traineeIds = Array.from(trainerTraineeIds);
      const trainees = await userRepo.find({ where: { id: In(traineeIds) } });
      
      const allSubmissions = await submissionRepo.find({
        where: { trainee: { id: In(traineeIds) } },
        relations: ['trainee', 'assignment']
      });
      
      const allEvaluations = await evaluationRepo.find({
        relations: ['submission', 'submission.user']
      });
      
      // Filter enrollments globally to find assigned LPs easily
      const allEnrollments = await enrollmentRepo.find({
        where: { user: { id: In(traineeIds) } },
        relations: ['user', 'learningPath']
      });

      for (const tUser of trainees) {
        const tId = tUser.id;
        const tName = `${tUser.firstName || ''} ${tUser.lastName || ''}`.trim() || tUser.email;
        
        const tEnrollments = allEnrollments.filter(e => e.user?.id === tId && e.learningPath?.id && myPathIds.includes(e.learningPath.id));
        const detailedLps = tEnrollments.map(e => ({
          title: e.learningPath.title,
          progress: Math.round(Math.random() * 100), // Note: for now keeping this simple or we can calculate real progress
          score: Math.round(Math.random() * 100),
          status: 'On Track'
        }));
        const assignedLps = Array.from(new Set(tEnrollments.map(e => e.learningPath.title))).join(', ') || 'Direct Assignments';

        // Calculate real detailed LPs progress if needed, but for now we supply the structure:
        const tAssignments = myAssignments.filter(a => {
           const inPath = a.learningPath?.id && tEnrollments.some(e => e.learningPath.id === a.learningPath?.id);
           const inModule = a.module?.learningPath?.id && tEnrollments.some(e => e.learningPath.id === a.module?.learningPath?.id);
           const inLesson = a.lesson?.module?.learningPath?.id && tEnrollments.some(e => e.learningPath.id === a.lesson?.module?.learningPath?.id);
           const isDirect = Array.isArray(a.assignedToTraineeIds) && a.assignedToTraineeIds.includes(tId);
           return inPath || inModule || inLesson || isDirect;
        });

        const tCompletedSubs = allSubmissions.filter(s => 
          (s.trainee?.id === tId || (s as any).user?.id === tId) && 
          ['Accepted', 'Evaluated'].includes(String(s.status)) &&
          tAssignments.some(a => a.id === s.assignment?.id)
        );

        const tCompletionRate = tAssignments.length > 0 
          ? (tCompletedSubs.length / tAssignments.length) * 100 
          : 0;

        let tEarnedScore = 0;
        let tMaxScore = 0;
        
        // From Submissions directly
        tCompletedSubs.forEach(s => {
          const sAssignment = tAssignments.find(a => a.id === s.assignment?.id);
          if (sAssignment) {
            const sMaxScore = Number(sAssignment.maxScore || 100);
            const sScore = Number(s.score || 0);
            if (Number.isFinite(sScore)) {
              tEarnedScore += sScore;
              tMaxScore += sMaxScore;
            }
          }
        });

        // From Evaluations
        const tEvaluations = allEvaluations.filter(e => {
          const eTraineeId = (e.submission as any)?.user?.id || (e.submission as any)?.trainee?.id;
          return String(eTraineeId) === String(tId) && tCompletedSubs.some(s => s.id === e.submission?.id);
        });

        tEvaluations.forEach(e => {
          const eMaxScore = 100;
          const eScore = Number(e.overallScore || 0);
          if (Number.isFinite(eScore)) {
            tEarnedScore += eScore;
            tMaxScore += eMaxScore;
          }
        });

        const tAvgScore = tMaxScore > 0 ? (tEarnedScore / tMaxScore) * 100 : 0;
        const isAtRisk = tCompletionRate < 30 || tAvgScore < 50;

        sumCompletionRate += tCompletionRate;
        sumAvgScore += tAvgScore;

        assignedTraineesProgress.push({
          traineeId: tId,
          traineeName: tName,
          assignedLps: assignedLps,
          detailedLps: detailedLps,
          progressPercent: Math.round(tCompletionRate),
          avgScore: Math.round(tAvgScore),
          status: isAtRisk ? 'At Risk' : 'On Track'
        });
      }
      
      assignedTraineesProgress.sort((a, b) => {
        if (a.status === 'At Risk' && b.status !== 'At Risk') return -1;
        if (a.status !== 'At Risk' && b.status === 'At Risk') return 1;
        return b.progressPercent - a.progressPercent;
      });
    }

    const traineeIdsArray = Array.from(trainerTraineeIds);
    const completionRate = traineeIdsArray.length > 0 ? sumCompletionRate / traineeIdsArray.length : 0;
    const averageScore = traineeIdsArray.length > 0 ? sumAvgScore / traineeIdsArray.length : 0;
    const trainingEffectiveness = Math.round(0.5 * completionRate + 0.5 * averageScore);

    // Dummy values for charts since the old charts components rely on them
    const progressTrends = [
      { date: 'Mon', submissions: 0, completions: 0 },
      { date: 'Tue', submissions: 0, completions: 0 }
    ];
    const weeklyScores = [
      { date: 'Mon', score: 0 },
      { date: 'Tue', score: 0 }
    ];
    const skillDistribution = [{ skill: 'Skill', score: 0 }];
    const moduleCompletion = [{ name: 'Module', completions: 0 }];
    const pathPerformance: any[] = [];
    const pathProgression = [{ date: 'Mon', completionRate: 0 }];

    return {
      platformTotalTrainees,
      platformTotalTrainers,
      trainerLpsCreated,
      trainerAssignments,
      trainerPendingReviews,
      totalTrainees: myTraineesCount,
      assignedTraineesProgress,
      completionRate: Math.round(completionRate),
      averageScore: Math.round(averageScore),
      trainingEffectiveness,
      // Fallbacks required by DashboardPage
      totalTasks: trainerAssignments.total,
      totalModules: 0,
      pendingReviews: trainerPendingReviews,
      completionGrowth: 0,
      charts: {
        progressTrends,
        weeklyScores,
        skillDistribution,
        moduleCompletion,
        pathPerformance,
        pathProgression
      }
    };
  }


  async getTrainerDashboardSummaryV2(currentUser: any) {
    const userId = currentUser.id || currentUser.sub;

    const userRepo = this.datasource.getRepository(UserEntity);
    const pathRepo = this.datasource.getRepository(LearningPathEntity);
    const assignmentRepo = this.datasource.getRepository(AssignmentEntity);
    const enrollmentRepo = this.datasource.getRepository(EnrollmentEntity);
    const submissionRepo = this.datasource.getRepository(AssignmentSubmissionEntity);
    const evaluationRepo = this.datasource.getRepository(EvaluationEntity);
    const moduleRepo = this.datasource.getRepository(ModuleEntity);
    const lessonRepo = this.datasource.getRepository(LessonEntity);
    const progressRepo = this.datasource.getRepository(UserLessonProgressEntity);
    const visitsRepo = this.datasource.getRepository(UserResourceVisitEntity);

    // 1. Platform Totals
    const platformTotalTrainees = await this.datasource.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM "User" u
      JOIN "UserRoles" ur ON u.id = ur."userId"
      JOIN "Role" r ON ur."roleId" = r.id
      WHERE r.name = 'Trainee' AND u.deleted_at IS NULL
    `).then(res => parseInt(res[0].count, 10));

    const platformTotalTrainers = await this.datasource.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM "User" u
      JOIN "UserRoles" ur ON u.id = ur."userId"
      JOIN "Role" r ON ur."roleId" = r.id
      WHERE r.name = 'Trainer' AND u.deleted_at IS NULL
    `).then(res => parseInt(res[0].count, 10));

    // 2. LPs Created
    const myPaths = await pathRepo.find({
      where: { createdBy: { id: userId } }
    });
    const trainerLpsCreated = myPaths.length;
    const myPathIds = myPaths.map(p => p.id);

    // 3. Assignments Created (Internal/External)
    const myAssignments = await assignmentRepo.find({
      where: { createdBy: { id: userId } },
      relations: ['learningPath', 'module', 'lesson']
    });
    
    const trainerAssignments = {
      total: myAssignments.length,
      internal: myAssignments.filter(a => !a.isExternal && (a.learningPath || a.module || a.lesson)).length,
      external: myAssignments.filter(a => a.isExternal || (!a.learningPath && !a.module && !a.lesson)).length
    };

    // 4. My Trainees (Distinct trainees assigned)
    const trainerTraineeIds = new Set<string>();
    const allEnrollments = await enrollmentRepo.find({
      relations: ['user', 'learningPath', 'assignedBy']
    });
    const allAssignments = await assignmentRepo.find({
      relations: ['learningPath', 'module', 'module.learningPath', 'lesson', 'lesson.module.learningPath']
    });
    const modules = await moduleRepo.find({ relations: ['lessons', 'resources', 'learningPath'] });
    const progressRows = await progressRepo.find({ relations: ['lesson', 'user'] });
    const visitRows = await visitsRepo.find({ relations: ['resource', 'user'] });

    for (const p of myPaths) {
      if (p.assignedToTraineeIds) p.assignedToTraineeIds.forEach(id => trainerTraineeIds.add(id));
    }
    
    if (myPathIds.length > 0) {
      const pathEnrollments = allEnrollments.filter(e => e.learningPath && myPathIds.includes(e.learningPath.id));
      pathEnrollments.forEach(e => {
        if (e.user) trainerTraineeIds.add(e.user.id);
      });
    }

    for (const a of myAssignments) {
      if (a.assignedToTraineeIds) a.assignedToTraineeIds.forEach(id => trainerTraineeIds.add(id));
    }

    const myTraineesCount = trainerTraineeIds.size;
    
    // 5. Pending Reviews
    let trainerPendingReviews = 0;
    if (trainerTraineeIds.size > 0 || myAssignments.length > 0) {
       // assigned_by mapping: if they are in my assignments or in an LP I created.
       const pendingSubs = await submissionRepo.find({
         where: { status: In(['Submitted', 'submitted', 'pending', 'Pending']) },
         relations: ['assignment', 'assignment.createdBy', 'trainee']
       });
       trainerPendingReviews = pendingSubs.filter(s => {
         const isMyAssignment = s.assignment?.createdBy?.id === userId;
         return isMyAssignment;
       }).length;
    }

    // 6. Assigned LPs & Trainee Progress
    const assignedTraineesProgress: any[] = [];
    let sumCompletionRate = 0;
    let totalEarnedScoreAll = 0;
    let totalMaxScoreAll = 0;
    let sumOnTimeRate = 0;
    let evaluatedTraineeCount = 0;
    let evaluatedTraineeOnTimeCount = 0;

    if (trainerTraineeIds.size > 0) {
      const traineeIds = Array.from(trainerTraineeIds);
      const trainees = await userRepo.find({ where: { id: In(traineeIds) } });
      
      const allSubmissions = await submissionRepo.find({
        where: { trainee: { id: In(traineeIds) } },
        relations: ['trainee', 'assignment']
      });
      
      const allEvaluations = await evaluationRepo.find({
        relations: ['submission', 'submission.user']
      });

      for (const tUser of trainees) {
        if (tUser.deletedAt) continue;
        const tId = tUser.id;
        const tName = `${tUser.firstName || ''} ${tUser.lastName || ''}`.trim() || tUser.email;
        
        const tEnrollments = allEnrollments.filter(e => e.user?.id === tId && e.learningPath?.id);
        const tEnrolledPathIds = new Set(tEnrollments.map(e => e.learningPath.id));
        const tTrainerEnrolledPathIds = new Set(
          tEnrollments
            .filter(e => e.assignedBy?.id === userId)
            .map(e => e.learningPath.id)
        );
        
        let expectedLessons = 0;
        let expectedResources = 0;
        const tModules = modules.filter(m => m.learningPath?.id && tEnrolledPathIds.has(m.learningPath.id));
        tModules.forEach(mod => {
           expectedLessons += (mod.lessons || []).length;
           expectedResources += (mod.resources || []).length;
        });
        
        const tAssignments = allAssignments.filter(a => {
           const inPath = a.learningPath?.id && tEnrolledPathIds.has(a.learningPath.id);
           const inModule = a.module?.learningPath?.id && tEnrolledPathIds.has(a.module.learningPath.id);
           const inLesson = a.lesson?.module?.learningPath?.id && tEnrolledPathIds.has(a.lesson.module.learningPath.id);
           const isDirect = Array.isArray(a.assignedToTraineeIds) && a.assignedToTraineeIds.includes(tId);
           return inPath || inModule || inLesson || isDirect;
        });
        const expectedAssignments = tAssignments.length;
        const totalExpected = expectedLessons + expectedResources + expectedAssignments;
        
        const tLessonsCompleted = new Set(progressRows.filter(p => p.user?.id === tId && p.isCompleted).map(p => p.lesson?.id)).size;
        const tResourcesVisited = new Set(visitRows.filter(v => v.user?.id === tId).map(v => v.resource?.id)).size;
        
        const tCompletedSubs = allSubmissions.filter(s => 
          (s.trainee?.id === tId || (s as any).user?.id === tId) && 
          ['Accepted', 'Evaluated', 'Approved'].includes(String(s.status)) &&
          tAssignments.some(a => a.id === s.assignment?.id)
        );
        const tAssignmentsCompleted = tCompletedSubs.filter(s => String(s.status) === 'Approved').length;

        const totalCompleted = tLessonsCompleted + tResourcesVisited + tAssignmentsCompleted;
        const tCompletionRate = totalExpected > 0 ? (totalCompleted / totalExpected) * 100 : 0;

        let tEarnedScore = 0;
        let tMaxScore = 0;
        
        tCompletedSubs.forEach(s => {
          const sAssignment = tAssignments.find(a => a.id === s.assignment?.id);
          if (sAssignment) {
            let isValidForTrainer = false;
            const lpId = sAssignment.learningPath?.id || sAssignment.module?.learningPath?.id || sAssignment.lesson?.module?.learningPath?.id;
            
            if (lpId) {
               isValidForTrainer = tTrainerEnrolledPathIds.has(lpId);
            } else {
               isValidForTrainer = myAssignments.some(a => a.id === sAssignment.id);
            }

            if (isValidForTrainer) {
              const sMaxScore = Number(sAssignment.maxScore || 100);
              const sScore = Number(s.score || 0);
              if (Number.isFinite(sScore)) {
                tEarnedScore += sScore;
                tMaxScore += sMaxScore;
                totalEarnedScoreAll += sScore;
                totalMaxScoreAll += sMaxScore;
              }
            }
          }
        });

        const tEvaluations = allEvaluations.filter(e => {
          const eTraineeId = (e.submission as any)?.user?.id || (e.submission as any)?.trainee?.id;
          return String(eTraineeId) === String(tId) && tCompletedSubs.some(s => s.id === e.submission?.id);
        });

        tEvaluations.forEach(e => {
          const s = tCompletedSubs.find(sub => sub.id === e.submission?.id);
          const sAssignment = s ? tAssignments.find(a => a.id === s.assignment?.id) : null;
          let isValidForTrainer = false;

          if (sAssignment) {
            const lpId = sAssignment.learningPath?.id || sAssignment.module?.learningPath?.id || sAssignment.lesson?.module?.learningPath?.id;
            
            if (lpId) {
               isValidForTrainer = tTrainerEnrolledPathIds.has(lpId);
            } else {
               isValidForTrainer = myAssignments.some(a => a.id === sAssignment.id);
            }
          }

          if (isValidForTrainer) {
            const eMaxScore = 100;
            const eScore = Number(e.overallScore || 0);
            if (Number.isFinite(eScore)) {
              tEarnedScore += eScore;
              tMaxScore += eMaxScore;
              totalEarnedScoreAll += eScore;
              totalMaxScoreAll += eMaxScore;
            }
          }
        });

        const hasEvaluations = tMaxScore > 0;
        const tAvgScore = hasEvaluations ? (tEarnedScore / tMaxScore) * 100 : 0;
        const isAtRisk = tCompletionRate < 30 || tAvgScore < 50;

        // On Time Submission Rate
        let onTimeCount = 0;
        let totalWithDeadline = 0;
        tCompletedSubs.forEach(s => {
           const sAssignment = tAssignments.find(a => a.id === s.assignment?.id);
           if (sAssignment && (sAssignment as any).dueDate) {
             totalWithDeadline++;
             if (new Date(s.submittedAt || s.createdAt) <= new Date((sAssignment as any).dueDate)) {
                onTimeCount++;
             }
           }
        });
        const onTimeRate = totalWithDeadline > 0 ? (onTimeCount / totalWithDeadline) * 100 : null;

        sumCompletionRate += tCompletionRate;
        if (tAvgScore !== null) {
           evaluatedTraineeCount += 1;
        }
        if (onTimeRate !== null) {
           sumOnTimeRate += onTimeRate;
           evaluatedTraineeOnTimeCount += 1;
        }

        assignedTraineesProgress.push({
          traineeId: tId,
          traineeName: tName,
          status: isAtRisk ? 'At Risk' : 'On Track',
          progressPercent: Math.round(tCompletionRate),
          avgScore: Math.round(tAvgScore),
          // Extra props for ui
          assignedLps: Array.from(new Set(tEnrollments.map(e => e.learningPath.title))).join(', ') || 'Direct Assignments',
        });
      }
      
      assignedTraineesProgress.sort((a, b) => {
        if (a.status === 'At Risk' && b.status !== 'At Risk') return -1;
        if (a.status !== 'At Risk' && b.status === 'At Risk') return 1;
        return b.progressPercent - a.progressPercent;
      });
    }

    const traineeIdsArray = Array.from(trainerTraineeIds);
    const avgCompletionRate = traineeIdsArray.length > 0 ? sumCompletionRate / traineeIdsArray.length : 0;
    const averageScore = totalMaxScoreAll > 0 ? (totalEarnedScoreAll / totalMaxScoreAll) * 100 : 0;
    const onTimeSubmissionRate = evaluatedTraineeOnTimeCount > 0 ? sumOnTimeRate / evaluatedTraineeOnTimeCount : 0;
    
    // Effectiveness
    let trainingEffectiveness: number | null = null;
    const c1 = avgCompletionRate ?? 0;
    const c2 = averageScore ?? 0;
    const c3 = onTimeSubmissionRate ?? 0;
    trainingEffectiveness = Math.round(0.40 * c1 + 0.40 * c2 + 0.20 * c3);

    // Dummy values for charts since the old charts components rely on them
    const progressTrends: any[] = [];
    const weeklyScores: any[] = [];
    const skillDistribution: any[] = [];
    const moduleCompletion: any[] = [];
    const pathPerformance: any[] = [];
    const pathProgression: any[] = [];

    return {
      platformTotalTrainees,
      platformTotalTrainers,
      trainerLpsCreated,
      trainerAssignments,
      trainerPendingReviews,
      totalTrainees: myTraineesCount,
      assignedTraineesProgress,
      avgCompletionRate: Math.round(avgCompletionRate),
      completionRate: Math.round(avgCompletionRate), // for legacy fallback
      averageScore: Math.round(averageScore),
      trainingEffectiveness,
      // Fallbacks required by DashboardPage
      totalTasks: trainerAssignments.total,
      totalModules: 0,
      pendingReviews: trainerPendingReviews,
      completionGrowth: 0,
      charts: {
        progressTrends,
        weeklyScores,
        skillDistribution,
        moduleCompletion,
        pathPerformance,
        pathProgression
      }
    };
  }

}
