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

  async getDashboardStats(currentUser?: any, requestedRole?: string) {
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

    let isTrainee =
      currentUser?.roles?.some(
        (r: any) => String(r.name || r).toLowerCase() === 'trainee',
      ) || currentUser?.primaryRole?.name === 'Trainee';
    let isTrainer =
      currentUser?.roles?.some(
        (r: any) => String(r.name || r).toLowerCase() === 'trainer',
      ) || currentUser?.primaryRole?.name === 'Trainer';
    let isAdmin =
      currentUser?.roles?.some(
        (r: any) => String(r.name || r).toLowerCase() === 'admin',
      ) || currentUser?.primaryRole?.name === 'Admin';

    if (requestedRole) {
      const lower = requestedRole.toLowerCase();
      if (lower === 'trainee') {
        isAdmin = false;
        isTrainer = false;
        isTrainee = true;
      } else if (lower === 'trainer') {
        isAdmin = false;
        isTrainer = true;
        isTrainee = false;
      } else if (lower === 'admin') {
        isAdmin = true;
        isTrainer = false;
        isTrainee = false;
      }
    }

    const userId = currentUser?.id || currentUser?.sub;

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
    ] = await Promise.all([
      userRepo.find({ relations: ['roles', 'primaryRole'] }),
      pathRepo.find({ relations: ['modules'] }),
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
        ],
      }),
      submissionRepo.count({
        where: Array.isArray(submissionWhereQuery)
          ? submissionWhereQuery.map((q) => ({ status: 'Submitted', ...q }))
          : { status: 'Submitted', ...submissionWhereQuery },
      }),
      enrollmentRepo.count({ where: { status: 'active' } as any }),
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
      ['Accepted', 'Evaluated', 'Rejected'].includes(String(s.status)),
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

    let enrollmentWhereQuery: any = { status: 'active' };
    if (isTrainee && !isTrainer && !isAdmin && userId) {
      enrollmentWhereQuery = { user: { id: userId }, status: 'active' };
    } else if (isTrainer && !isAdmin && userId) {
      if (trainerTraineeIds.size > 0) {
        enrollmentWhereQuery = {
          user: { id: In(Array.from(trainerTraineeIds)) },
          status: 'active',
        };
      } else {
        enrollmentWhereQuery = { user: { id: IsNull() } };
      }
    }

    // Skill / path distribution from enrollments + paths
    const enrollments = await enrollmentRepo.find({
      where: enrollmentWhereQuery,
      relations: ['learningPath', 'user'],
    });
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
      // Trainee skill distribution logic
      const skillCounts = new Map<string, number>();
      enrollments.forEach((e) => {
        const title = e.learningPath?.title || 'Unassigned';
        skillCounts.set(title, (skillCounts.get(title) || 0) + 1);
      });
      if (skillCounts.size === 0) {
        // If no paths assigned, do not fall back to all paths
      }
      const skillTotal = [...skillCounts.values()].reduce((a, b) => a + b, 0);
      const rawDistribution = [...skillCounts.entries()].map(
        ([name, count]) => ({
          name,
          count,
          percent: skillTotal > 0 ? (count / skillTotal) * 100 : 0,
        }),
      );

      let integerSum = 0;
      const sortedByRemainder = rawDistribution
        .map((item) => {
          const intPart = Math.floor(item.percent);
          integerSum += intPart;
          return { ...item, intPart, remainder: item.percent - intPart };
        })
        .sort((a, b) => b.remainder - a.remainder);

      let diff = (skillTotal > 0 ? 100 : 0) - integerSum;
      skillDistribution = sortedByRemainder.map((item) => {
        if (diff > 0) {
          diff--;
          return {
            name: item.name,
            count: item.count,
            percent: item.intPart + 1,
          };
        }
        return { name: item.name, count: item.count, percent: item.intPart };
      });
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
                  ['Accepted', 'Evaluated'].includes(String(s.status)) &&
                  assignmentIds.includes(s.assignment?.id),
              )
              .map((s) => s.assignment?.id),
          ).size;

          const uCompleted = uLessons + uResources + uAssignments;
          totalCompletedItems += uCompleted;
          sumPercents += (uCompleted / totalItemsPerUser) * 100;
        }
      }

      const numEnrolled =
        enrolledUserIds.length > 0 ? enrolledUserIds.length : 1;
      const totalExpected = totalItemsPerUser * numEnrolled;
      const percent =
        totalItemsPerUser > 0 && enrolledUserIds.length > 0
          ? Math.round(sumPercents / enrolledUserIds.length)
          : 0;

      const moduleSubs = allSubmissions.filter((s) =>
        assignmentIds.includes(s.assignment?.id),
      );
      const moduleScores = moduleSubs
        .map((s) => Number(s.score))
        .filter((n) => Number.isFinite(n));
      const avg =
        moduleScores.length > 0
          ? Math.round(
              moduleScores.reduce((a, b) => a + b, 0) / moduleScores.length,
            )
          : 0;

      return {
        id: mod.id,
        title: mod.title,
        pathTitle: mod.learningPath?.title || '',
        completed: totalCompletedItems,
        total: totalExpected,
        percent: Math.min(100, percent),
        averageScore: avg,
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
          ['Accepted', 'Evaluated'].includes(String(s.status)),
        ).length;
        const scores = pathSubs
          .map((s) => Number(s.score))
          .filter((n) => Number.isFinite(n));
        const avg =
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;

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
          a.assignedToTraineeIds.includes(userId);
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

    // Trainee Progress List for Trainers
    const traineeStatsMap = new Map<
      string,
      { id: string | number; completed: number; submitted: number }
    >();
    if (isTrainer && !isAdmin) {
      allSubmissions.forEach((s) => {
        const tId = s.trainee?.id || (s as any).traineeId;
        const tUser = s.trainee || users.find((u) => u.id === tId);
        const tName =
          tUser && (tUser.firstName || tUser.lastName)
            ? `${tUser.firstName || ''} ${tUser.lastName || ''}`.trim()
            : 'Trainee ' + String(tId).substring(0, 4);
        if (tId) {
          const stats = traineeStatsMap.get(tName) || {
            id: tId,
            completed: 0,
            submitted: 0,
          };
          stats.submitted += 1;
          if (['Accepted', 'Evaluated'].includes(String(s.status))) {
            stats.completed += 1;
          }
          traineeStatsMap.set(tName, stats);
        }
      });
    }

    const traineeProgressList = Array.from(traineeStatsMap.entries()).map(
      ([name, stats]) => {
        const expected = scopedAssignments > 0 ? scopedAssignments : 10;
        const remaining = Math.max(0, expected - stats.completed);
        const progress =
          expected > 0
            ? Math.min(Math.round((stats.completed / expected) * 100), 100)
            : 0;
        return {
          name,
          id: stats.id,
          completed: stats.completed,
          remaining,
          progress,
        };
      },
    );

    // Real Stats Calculations
    const nowMs = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Tasks completed
    const scopedAssignmentIds = new Set(scopedAssignmentsList.map((a) => a.id));
    const completedAssignmentIds = new Set<string>();
    evaluatedSubs.forEach((s) => {
      if (
        ['Accepted', 'Evaluated'].includes(String(s.status)) &&
        s.assignment?.id
      ) {
        if (!isTrainee || scopedAssignmentIds.has(s.assignment.id)) {
          completedAssignmentIds.add(s.assignment.id);
        }
      }
    });
    const actualTasksCompleted = isTrainee
      ? completedAssignmentIds.size
      : evaluatedSubs.length;

    // Default calculations (will be overridden for Admin/Trainer)
    let completionRate =
      scopedAssignments > 0
        ? Math.round((actualTasksCompleted / scopedAssignments) * 100)
        : 0;

    // Learning velocity (last 7 days activity)
    const recentSubmissions = allSubmissions.filter((s) => {
      const d = new Date(s.submittedAt || s.createdAt).getTime();
      return nowMs - d <= 7 * dayMs;
    });

    const [recentProgressCount, recentVisitsCount] = await Promise.all([
      progressRepo.count({
        where: isTrainee
          ? ({
              user: { id: userId },
              updatedAt: MoreThan(new Date(nowMs - 7 * dayMs)),
            } as any)
          : ({ updatedAt: MoreThan(new Date(nowMs - 7 * dayMs)) } as any),
      }),
      visitsRepo.count({
        where: isTrainee
          ? ({
              user: { id: userId },
              visitedAt: MoreThan(new Date(nowMs - 7 * dayMs)),
            } as any)
          : ({ visitedAt: MoreThan(new Date(nowMs - 7 * dayMs)) } as any),
      }),
    ]);

    const learningVelocity =
      recentSubmissions.length + recentProgressCount + recentVisitsCount;

    let skillGrowth = 0;
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

    const totalMaxScore =
      scopedAssignmentsList.length > 0
        ? scopedAssignmentsList.reduce((acc, a) => acc + (a.maxScore || 100), 0)
        : 100;

    const bestScoreByAssignment = new Map<string, number>();
    evaluatedSubs.forEach((s) => {
      const aId = s.assignment?.id;
      if (aId) {
        if (!isTrainee || scopedAssignmentIds.has(aId)) {
          const currentBest = bestScoreByAssignment.get(aId) || 0;
          const sScore = Number(s.score || 0);
          if (sScore > currentBest) bestScoreByAssignment.set(aId, sScore);
        }
      }
    });

    const totalGainedScore = isTrainee
      ? Array.from(bestScoreByAssignment.values()).reduce((a, b) => a + b, 0)
      : allScores.reduce((a, b) => a + b, 0);
    let averageScore =
      totalMaxScore > 0
        ? Math.round((totalGainedScore / totalMaxScore) * 100)
        : 0;
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

    return {
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
    let bucketType: 'hour' | 'day' | 'month' = 'day';

    if (filter === 'today') {
      finalStartDate.setHours(0, 0, 0, 0);
      finalEndDate.setHours(23, 59, 59, 999);
      bucketType = 'hour';
    } else if (filter === 'week') {
      finalStartDate.setDate(finalStartDate.getDate() - 6);
      finalStartDate.setHours(0, 0, 0, 0);
      finalEndDate.setHours(23, 59, 59, 999);
      bucketType = 'day';
    } else if (filter === 'month') {
      finalStartDate.setDate(1);
      finalStartDate.setHours(0, 0, 0, 0);
      finalEndDate.setHours(23, 59, 59, 999);
      bucketType = 'day';
    } else if (filter === 'year') {
      finalStartDate.setMonth(finalStartDate.getMonth() - 11);
      finalStartDate.setDate(1);
      finalStartDate.setHours(0, 0, 0, 0);
      // to end of current month
      finalEndDate.setMonth(finalEndDate.getMonth() + 1);
      finalEndDate.setDate(0);
      finalEndDate.setHours(23, 59, 59, 999);
      bucketType = 'month';
    } else if (filter === 'custom' && customStartDate && customEndDate) {
      finalStartDate = new Date(customStartDate);
      finalStartDate.setHours(0, 0, 0, 0);
      finalEndDate = new Date(customEndDate);
      finalEndDate.setHours(23, 59, 59, 999);
      bucketType = 'day';
    } else {
      finalStartDate.setDate(finalStartDate.getDate() - range + 1);
      finalStartDate.setHours(0, 0, 0, 0);
      finalEndDate.setHours(23, 59, 59, 999);
      bucketType = 'day';
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

    const days: { [key: string]: ReturnType<typeof createBucket> } = {};

    if (bucketType === 'hour') {
      for (let i = 0; i < 24; i++) {
        const iso = `${i.toString().padStart(2, '0')}:00`;
        days[iso] = createBucket(iso, iso);
      }
    } else if (bucketType === 'day') {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysCount = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
      for (let i = 0; i <= daysCount; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        if (d > endDate) break;
        const iso = d.toISOString().split('T')[0];
        const name = d.toLocaleString('en', { month: 'short', day: 'numeric' });
        days[iso] = createBucket(iso, name);
      }
    } else if (bucketType === 'month') {
      for (let i = 0; i <= 12; i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        if (d > endDate) break;
        const iso = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const name = d.toLocaleString('en', { month: 'short', year: '2-digit' });
        days[iso] = createBucket(iso, name);
      }
    }

    const getIsoKey = (date: Date) => {
      if (bucketType === 'hour') {
        return `${date.getHours().toString().padStart(2, '0')}:00`;
      } else if (bucketType === 'month') {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }
      return date.toISOString().split('T')[0];
    };

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

          if (['Accepted', 'Evaluated'].includes(String(sub.status))) {
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
        
        dailyScore = lessons + tasks + resources;
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
}
