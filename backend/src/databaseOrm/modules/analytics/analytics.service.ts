import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { EnrollmentEntity } from '../../entities/enrollment.entity';
import { EvaluationEntity } from '../../entities/evaluation.entity';
import { UserLessonProgressEntity } from '../../entities/userLessonProgress.entity';

@Injectable()
export class AnalyticsEntityService {
  constructor(private readonly datasource: DataSource) {}

  async getDashboardStats(currentUser?: any) {
    const userRepo = this.datasource.getRepository(UserEntity);
    const pathRepo = this.datasource.getRepository(LearningPathEntity);
    const moduleRepo = this.datasource.getRepository(ModuleEntity);
    const lessonRepo = this.datasource.getRepository(LessonEntity);
    const assignmentRepo = this.datasource.getRepository(AssignmentEntity);
    const submissionRepo = this.datasource.getRepository(AssignmentSubmissionEntity);
    const enrollmentRepo = this.datasource.getRepository(EnrollmentEntity);
    const evaluationRepo = this.datasource.getRepository(EvaluationEntity);
    const progressRepo = this.datasource.getRepository(UserLessonProgressEntity);

    const isTrainee = currentUser?.roles?.some((r: any) => String(r.name || r).toLowerCase() === 'trainee');
    const isTrainer = currentUser?.roles?.some((r: any) => String(r.name || r).toLowerCase() === 'trainer');
    const isAdmin = currentUser?.roles?.some((r: any) => String(r.name || r).toLowerCase() === 'admin');
    const userId = currentUser?.id;
    let trainerExpected = 0;
    let trainerSubmitted = 0;
    let tasksCompleted = 0;
    let activityTimestamps: any[] = [];
    let currentStreak = 0;


    const [
      users,
      paths,
      modules,
      totalLessons,
      totalAssignments,
      pendingReviews,
      activeEnrollments,
      allSubmissions,
      evaluations,
      progressRows,
    ] = await Promise.all([
      userRepo.find({ relations: ['roles', 'primaryRole'] }),
      pathRepo.find({ relations: ['modules'] }),
      moduleRepo.find({ relations: ['lessons', 'learningPath'] }),
      lessonRepo.count(),
      assignmentRepo.count(),
      submissionRepo.count({ where: { status: 'Submitted' } as any }),
      enrollmentRepo.count({ where: { status: 'active' } as any }),
      submissionRepo.find({
        relations: ['trainee', 'assignment', 'assignment.learningPath', 'assignment.module'],
        order: { submittedAt: 'DESC' },
        take: 1000,
      }),
      evaluationRepo.find({
        relations: ['submission'],
        order: { createdAt: 'DESC' },
        take: 500,
      }),
      progressRepo.find({ relations: ['lesson', 'lesson.module'], take: 2000 }),
    ]);

    let totalTrainers = 0;
    let totalTrainees = 0;
    users.forEach((u) => {
      const roleNames = [
        (u as any).primaryRole?.name,
        ...((u.roles || []).map((r: any) => r.name || r)),
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
    const evalScores = evaluations
      .map((e) => Number(e.overallScore))
      .filter((n) => Number.isFinite(n));
    const allScores = [...scored, ...evalScores];
    const averageScore =
      allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0;

    const completionRate =
      totalAssignments > 0
        ? Math.min(
            Math.round(
              (evaluatedSubs.filter((s) => s.status === 'Accepted' || s.status === 'Evaluated')
                .length /
                totalAssignments) *
                100,
            ),
            100,
          )
        : 0;

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

    evaluations.forEach((e) => {
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
      averageScore: w.scoreCount > 0 ? Math.round(w.scoreSum / w.scoreCount) : 0,
      submissions: w.submissions,
    }));

    // Skill / path distribution from enrollments + paths
    const enrollments = await enrollmentRepo.find({ relations: ['learningPath'] });
    const skillCounts = new Map<string, number>();
    enrollments.forEach((e) => {
      const title = e.learningPath?.title || 'Unassigned';
      skillCounts.set(title, (skillCounts.get(title) || 0) + 1);
    });
    if (skillCounts.size === 0) {
      paths.forEach((p) => skillCounts.set(p.title || 'Path', 0));
    }
    const skillTotal = [...skillCounts.values()].reduce((a, b) => a + b, 0);
    const skillDistribution = [...skillCounts.entries()].map(([name, count]) => ({
      name,
      count,
      percent: skillTotal > 0 ? Math.round((count / skillTotal) * 100) : 0,
    }));

    // Module completion from lesson progress
    const moduleCompletion = modules.map((mod) => {
      const lessonIds = (mod.lessons || []).map((l) => l.id);
      const total = lessonIds.length;
      const completed = progressRows.filter(
        (p) => p.isCompleted && lessonIds.includes(p.lesson?.id),
      ).length;
      const moduleSubs = allSubmissions.filter(
        (s) => s.assignment?.module?.id === mod.id || (s.assignment as any)?.moduleId === mod.id,
      );
      const moduleScores = moduleSubs
        .map((s) => Number(s.score))
        .filter((n) => Number.isFinite(n));
      const avg =
        moduleScores.length > 0
          ? Math.round(moduleScores.reduce((a, b) => a + b, 0) / moduleScores.length)
          : 0;
      return {
        id: mod.id,
        title: mod.title,
        pathTitle: mod.learningPath?.title || '',
        completed,
        total,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        averageScore: avg,
      };
    });

    // Path performance bars
    const pathPerformance = paths.map((p) => {
      const pathSubs = allSubmissions.filter(
        (s) =>
          s.assignment?.learningPath?.id === p.id ||
          (s.assignment as any)?.learningPathId === p.id,
      );
      const submitted = pathSubs.length;
      const completed = pathSubs.filter((s) =>
        ['Accepted', 'Evaluated'].includes(String(s.status)),
      ).length;
      const scores = pathSubs.map((s) => Number(s.score)).filter((n) => Number.isFinite(n));
      const avg =
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return {
        id: p.id,
        title: p.title,
        submitted,
        completed,
        averageScore: avg,
      };
    });

    const previousMonth = progressTrends[progressTrends.length - 2];
    const currentMonth = progressTrends[progressTrends.length - 1];
    const completionGrowth =
      previousMonth && previousMonth.completions > 0
        ? Math.round(
            ((currentMonth.completions - previousMonth.completions) / previousMonth.completions) *
              100,
          )
        : currentMonth?.completions
          ? 100
          : 0;

    const recentActivity = allSubmissions.slice(0, 8);

    return {
      totalUsers: users.length,
      totalTrainers,
      totalTrainees,
      totalPaths: paths.length,
      totalModules: modules.length,
      totalLessons,
      totalAssignments,
      pendingReviews,
      completionRate,
      averageScore,
      activeEnrollments,
      completionGrowth,
      recentActivity,
      charts: {
        progressTrends,
        weeklyScores,
        skillDistribution,
        moduleCompletion,
        pathPerformance,
      },
    };
  }

  private buildLastNMonths(n: number) {
    const now = new Date();
    const months: { key: string; label: string; submissions: number; completions: number }[] = [];
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
}
