import axios from 'axios';
import { API_BASE_URL } from '../api';

const auth = (token?: string) => ({
  withCredentials: true,
  headers: {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  },
});

export type ChartBundle = {
  progressTrends: { label: string; submissions: number; completions: number }[];
  dailyProgressTrends?: { label: string; submissions: number; completions: number }[];
  weeklyProgressTrends?: { label: string; submissions: number; completions: number }[];
  yearlyProgressTrends?: { label: string; submissions: number; completions: number }[];
  weeklyScores: { label: string; averageScore: number; submissions: number }[];
  dailyScores?: { label: string; averageScore: number; submissions: number }[];
  monthlyScores?: { label: string; averageScore: number; submissions: number }[];
  skillDistribution: { name: string; count: number; percent: number }[];
  traineeProgressList?: any[];
  pathProgression?: any[];
  moduleCompletion: {
    id: string;
    title: string;
    pathTitle: string;
    completed: number;
    total: number;
    percent: number;
    averageScore: number;
  }[];
  pathPerformance: {
    id: string;
    title: string;
    submitted: number;
    completed: number;
    averageScore: number;
  }[];
};

export type DashboardAnalytics = {
  totalUsers: number;
  totalTrainers: number;
  totalTrainees: number;
  totalPaths: number;
  totalModules: number;
  totalLessons: number;
  totalAssignments: number;
  pendingReviews: number;
  completionRate: number;
  averageScore: number;
  activeEnrollments: number;
  completionGrowth: number;
  recentActivity: any[];
  charts: ChartBundle;
  skillGrowth?: number;
  tasksCompleted?: number;
  totalGainedScore?: number;
  totalMaxScore?: number;
  learningVelocity?: number;
  consistencyScore?: number;
  currentStreak?: number;
  learningStyle?: string;
  celebrateStreak?: boolean;
  estimatedCompletionDate?: string;
  trainingEffectiveness?: number;
};

const emptyCharts = (): ChartBundle => ({
  progressTrends: [],
  dailyProgressTrends: [],
  weeklyProgressTrends: [],
  yearlyProgressTrends: [],
  weeklyScores: [],
  dailyScores: [],
  monthlyScores: [],
  skillDistribution: [],
  moduleCompletion: [],
  pathPerformance: [],
});

export const analyticsService = {
  fetchDashboard: async (token: string, role?: string): Promise<DashboardAnalytics> => {
    const query = role ? `?role=${role.toLowerCase()}` : '';
    const { data } = await axios.get(`${API_BASE_URL}/analytics/dashboard${query}`, auth(token));
    return {
      totalUsers: data?.totalUsers ?? 0,
      totalTrainers: data?.totalTrainers ?? 0,
      totalTrainees: data?.totalTrainees ?? 0,
      totalPaths: data?.totalPaths ?? 0,
      totalModules: data?.totalModules ?? 0,
      totalLessons: data?.totalLessons ?? 0,
      totalAssignments: data?.totalAssignments ?? 0,
      pendingReviews: data?.pendingReviews ?? 0,
      completionRate: data?.completionRate ?? 0,
      averageScore: data?.averageScore ?? 0,
      activeEnrollments: data?.activeEnrollments ?? 0,
      completionGrowth: data?.completionGrowth ?? 0,
      recentActivity: Array.isArray(data?.recentActivity) ? data.recentActivity : [],
      skillGrowth: data?.skillGrowth,
      tasksCompleted: data?.tasksCompleted,
      totalGainedScore: data?.totalGainedScore,
      totalMaxScore: data?.totalMaxScore,
      learningVelocity: data?.learningVelocity,
      consistencyScore: data?.consistencyScore,
      currentStreak: data?.currentStreak,
      learningStyle: data?.learningStyle,
      celebrateStreak: data?.celebrateStreak,
      estimatedCompletionDate: data?.estimatedCompletionDate,
      trainingEffectiveness: data?.trainingEffectiveness,
      charts: data?.charts
        ? {
            progressTrends: data.charts.progressTrends || [],
            dailyProgressTrends: data.charts.dailyProgressTrends,
            weeklyProgressTrends: data.charts.weeklyProgressTrends,
            yearlyProgressTrends: data.charts.yearlyProgressTrends,
            weeklyScores: data.charts.weeklyScores || [],
            dailyScores: data.charts.dailyScores,
            monthlyScores: data.charts.monthlyScores,
            skillDistribution: data.charts.skillDistribution || [],
            moduleCompletion: data.charts.moduleCompletion || [],
            pathPerformance: data.charts.pathPerformance || [],
            traineeProgressList: data.charts.traineeProgressList || [],
            pathProgression: data.charts.pathProgression || [],
          }
        : emptyCharts(),
    };
  },
  celebrateStreak: async (val: number, token: string) => {
    // Return dummy true for now, since it wasn't implemented before
    return true;
  },
};

export const progressService = {
  fetchMyStats: async (token: string, learningPathId?: string) => {
    const qs = learningPathId ? `?learningPathId=${learningPathId}` : '';
    const { data } = await axios.get(`${API_BASE_URL}/progress/stats/me${qs}`, auth(token));
    return {
      completedLessons: data?.completedLessons ?? 0,
      totalLessons: data?.totalLessons ?? 0,
      completionPercent: data?.completionPercent ?? 0,
      visitedResources: data?.visitedResources ?? 0,
      totalResources: data?.totalResources ?? 0,
      totalAssignments: data?.totalAssignments ?? 0,
      tasksSubmitted: data?.tasksSubmitted ?? 0,
      tasksAccepted: data?.tasksAccepted ?? 0,
      tasksRejected: data?.tasksRejected ?? 0,
      tasksPending: data?.tasksPending ?? 0,
      averageScore: data?.averageScore ?? 0,
      lessonProgressPercent: data?.lessonProgressPercent ?? 0,
      resourceProgressPercent: data?.resourceProgressPercent ?? 0,
      taskProgressPercent: data?.taskProgressPercent ?? 0,
      completedLessonIds: Array.isArray(data?.completedLessonIds) ? data.completedLessonIds : [],
      visitedResourceIds: Array.isArray(data?.visitedResourceIds) ? data.visitedResourceIds : [],
    };
  },
  fetchMyProgress: async (token: string) => {
    const { data } = await axios.get(`${API_BASE_URL}/progress/me`, auth(token));
    return Array.isArray(data) ? data : [];
  },
  completeLesson: async (lessonId: string, token: string) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/progress/lessons/${lessonId}/complete`,
      {},
      auth(token),
    );
    return data;
  },
  visitResource: async (resourceId: string, token: string) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/progress/resources/${resourceId}/visit`,
      {},
      auth(token),
    );
    return data;
  },
  fetchCohort: async (token: string) => {
    const { data } = await axios.get(`${API_BASE_URL}/progress/cohort`, auth(token));
    return data;
  },
  fetchPathProgressSummary: async (token: string) => {
    const { data } = await axios.get(`${API_BASE_URL}/progress/learning-paths/summary`, auth(token));
    return data || {};
  },
};

export const enrollmentService = {
  fetchMine: async (token: string) => {
    const { data } = await axios.get(`${API_BASE_URL}/enrollments/me`, auth(token));
    return Array.isArray(data) ? data : [];
  },
  enroll: async (learningPathId: string, token: string, userId?: string) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/enrollments`,
      { learningPathId, userId },
      auth(token),
    );
    return data;
  },
};

export const aiCoachService = {
  listConversations: async (token: string) => {
    const { data } = await axios.get(`${API_BASE_URL}/ai/conversations`, auth(token));
    return Array.isArray(data) ? data : [];
  },
  createConversation: async (token: string, title?: string) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/ai/conversations`,
      { title },
      auth(token),
    );
    return data;
  },
  getConversation: async (id: string, token: string) => {
    const { data } = await axios.get(`${API_BASE_URL}/ai/conversations/${id}`, auth(token));
    return data;
  },
  sendMessage: async (id: string, content: string, token: string) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/ai/conversations/${id}/messages`,
      { content },
      auth(token),
    );
    return data;
  },
};
