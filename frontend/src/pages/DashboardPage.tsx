import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { InviteUserModal } from '../components/users/InviteUserModal';
import { UsersSection } from '../components/users/UserManagement';
import { LearningPathsSection } from '../components/LearningPathsSection/LearningPathsSection';
import { CurriculumManager } from '../components/CurriculumManager/CurriculumManager';
import { TraineeCurriculumView } from '../components/TraineeSubmissionsView/TraineeCurriculumView';
import { TrainerEvaluationDashboard } from '../components/TrainerEvaluationDashboard/TrainerEvaluationDashboard';
import { TraineeSubmissionsView } from '../components/TraineeSubmissionsView/TraineeSubmissionsView';
import { TraineeAssignmentsView } from '../components/TraineeSubmissionsView/TraineeAssignmentsView';
import { ProgressAnalyticsSection } from '../components/ProgressAnalyticsSection/ProgressAnalyticsSection';
import { SettingsSection } from '../components/SettingsSection/SettingsSection';
import { userService } from '../services/userService';
import { learningPathService } from '../services/learningPathService';
import { assignmentService } from '../services/assignmentService';
import { analyticsService, progressService, type ChartBundle } from '../services/lmsApi';
import { ModulesManagementSection } from '../components/ModulePathSection/ModulesManagementSection';
import { seriesToAreaPath, seriesToPolyline } from '../utils/charts';
import { useNotifications } from '../context/NotificationContext';
import type { RoleName, SessionUser } from '../types/auth';

type DashboardPageProps = {
  accessToken: string;
  activeRole: RoleName;
  activeSection: string;
  currentUser: SessionUser;
};

type VisibleUser = {
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  primaryRole: RoleName;
  status: 'invited' | 'activated';
};

export function DashboardPage({
  accessToken,
  activeRole,
  activeSection,
  currentUser,
}: DashboardPageProps) {
  const navigate = useNavigate();
  const { refresh: refreshNotifications } = useNotifications();
  // Chart tooltip state
  const [chartTooltip, setChartTooltip] = useState<{ visible: boolean; x: number; y: number; label: string; value: string }>({ visible: false, x: 0, y: 0, label: '', value: '' });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedPathTitle, setSelectedPathTitle] = useState<string>('');

  const [, setUsers] = useState<VisibleUser[]>([
    {
      email: currentUser.email,
      firstName: currentUser.firstName ?? 'Admin',
      lastName: currentUser.lastName ?? 'User',
      roles: currentUser.roles,
      primaryRole: currentUser.primaryRole,
      status: 'activated',
    },
  ]);

  // LIVE DATABASE METRICS STATE
  const [dbData, setDbData] = useState({
    totalUsers: 0,
    totalTrainers: 0,
    totalTrainees: 0,
    totalPaths: 0,
    totalModules: 0,
    totalTasks: 0,
    pendingReviews: 0,
    acceptedCount: 0,
    completionRate: 0,
    averageScore: 0,
    totalLessons: 0,
  });

  const [traineePath, setTraineePath] = useState<any | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [, setMySubmissions] = useState<any[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [progressStats, setProgressStats] = useState({
    completedLessons: 0,
    totalLessons: 0,
    completionPercent: 0,
  });
  const [charts, setCharts] = useState<ChartBundle>({
    progressTrends: [],
    weeklyScores: [],
    skillDistribution: [],
    moduleCompletion: [],
    pathPerformance: [],
  });
  const [completionGrowth, setCompletionGrowth] = useState(0);

  const isAdmin = useMemo(() => activeRole.toLowerCase() === 'admin', [activeRole]);
  const isTrainee = useMemo(() => activeRole.toLowerCase() === 'trainee', [activeRole]);

  const addInvitedUser = (user: Omit<VisibleUser, 'status'>) => {
    setUsers((current) => [{ ...user, status: 'invited' }, ...current]);
  };

  const handleBackToAllPaths = () => {
    setSelectedPathId(null);
    setSelectedPathTitle('');
    navigate('/learning-paths');
  };

  // 🌟 FETCH REAL DATABASE METRICS ON MOUNT OR ROLE/TOKEN CHANGE
  useEffect(() => {
    let isMounted = true;

    const fetchDatabaseMetrics = async () => {
      setIsLoadingMetrics(true);
      try {
        const [analytics, usersList, pathsList, pendingSubs, mySubs, myProgress] = await Promise.all([
          analyticsService.fetchDashboard(accessToken).catch(() => null),
          userService.fetchAllUsers(accessToken).catch(() => []),
          learningPathService.fetchAllPaths(accessToken).catch(() => []),
          assignmentService.fetchPendingSubmissions(accessToken).catch(() => []),
          isTrainee ? assignmentService.fetchMySubmissions(accessToken).catch(() => []) : Promise.resolve([]),
          progressService.fetchMyStats(accessToken).catch(() => ({
            completedLessons: 0,
            totalLessons: 0,
            completionPercent: 0,
          })),
        ]);

        if (!isMounted) return;

        setProgressStats(myProgress);
        if (analytics?.charts) setCharts(analytics.charts);
        setCompletionGrowth(analytics?.completionGrowth ?? 0);

        let trainersCount = 0;
        let traineesCount = 0;
        (usersList || []).forEach((u: any) => {
          const roles = [
            u.role,
            u.primaryRole?.name,
            ...(Array.isArray(u.roles) ? u.roles.map((r: any) => r.name || r) : []),
          ].map((r) => String(r || '').toLowerCase());
          if (roles.includes('trainer')) trainersCount++;
          if (roles.includes('trainee')) traineesCount++;
        });

        let moduleCount = 0;
        let taskCount = 0;
        const tasksTree: any[] = [];

        (pathsList || []).forEach((p: any) => {
          // 1. Catch STANDALONE / EXTERNAL tasks attached directly to the learning path
          if (p.assignments && p.assignments.length > 0) {
            p.assignments.forEach((a: any) => {
              if (!a.lessonId) {
                taskCount++;
                tasksTree.push({
                  id: a.id,
                  title: a.title,
                  moduleTitle: 'Standalone Assignment',
                  due: a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'Due Soon',
                  priority: a.assignmentType === 'External' ? 'high' : 'medium',
                  type: a.assignmentType,
                  externalUrl: a.externalUrl,
                });
              }
            });
          }

          // 2. Catch INTERNAL tasks attached to modules -> lessons
          if (p.modules) {
            moduleCount += p.modules.length;
            p.modules.forEach((m: any) => {
              m.lessons?.forEach((l: any) => {
                if (l.assignments) {
                  taskCount += l.assignments.length;
                  l.assignments.forEach((a: any) => {
                    tasksTree.push({
                      id: a.id,
                      title: a.title,
                      moduleTitle: m.title,
                      due: a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'Due Soon',
                      priority: a.assignmentType === 'MCQ' ? 'medium' : 'high',
                      type: a.assignmentType,
                      externalUrl: a.externalUrl,
                    });
                  });
                }
              });
            });
          }
        });

        const pendingCount = analytics?.pendingReviews ?? (pendingSubs?.length || 0);
        const acceptedCount = (mySubs || []).filter((s: any) => s.status === 'Accepted').length;
        const calcRate =
          analytics?.completionRate ??
          (taskCount > 0
            ? Math.min(Math.round((acceptedCount / taskCount) * 100), 100)
            : myProgress.completionPercent || 0);

        // Notification bell is driven by NotificationProvider (poll + mark-read on sections)
        void refreshNotifications();

        setDbData({
          totalUsers: analytics?.totalUsers ?? usersList?.length ?? 0,
          totalTrainers: analytics?.totalTrainers ?? trainersCount,
          totalTrainees: analytics?.totalTrainees ?? traineesCount,
          totalPaths: analytics?.totalPaths ?? pathsList?.length ?? 0,
          totalModules: analytics?.totalModules ?? moduleCount,
          totalTasks: analytics?.totalAssignments ?? taskCount,
          pendingReviews: pendingCount,
          acceptedCount,
          completionRate: calcRate,
          averageScore: analytics?.averageScore ?? 0,
          totalLessons: analytics?.totalLessons ?? myProgress.totalLessons ?? 0,
        });

        setPendingSubmissions(pendingSubs || analytics?.recentActivity || []);
        setMySubmissions(mySubs || []);

        if (isTrainee && pathsList?.length > 0) {
          const assigned =
            pathsList.find((p: any) => p.assignedToTraineeIds?.includes(currentUser.id)) ||
            pathsList[0];
          setTraineePath(assigned);
          setUpcomingTasks(tasksTree.slice(0, 4));
        } else {
          setTraineePath(null);
          setUpcomingTasks([]);
        }
      } catch (err) {
        console.error('Failed to load database metrics:', err);
        if (isMounted) {
          setDbData({
            totalUsers: 0,
            totalTrainers: 0,
            totalTrainees: 0,
            totalPaths: 0,
            totalModules: 0,
            totalTasks: 0,
            pendingReviews: 0,
            acceptedCount: 0,
            completionRate: 0,
            averageScore: 0,
            totalLessons: 0,
          });
        }
      } finally {
        if (isMounted) setIsLoadingMetrics(false);
      }
    };

    fetchDatabaseMetrics();
    return () => {
      isMounted = false;
    };
  }, [accessToken, activeRole, currentUser.id, isTrainee]);

  // ========================================================
  // ROUTING ENGINE VIEW CONDITIONALS 
  // ========================================================

  if (isAdmin && activeSection === 'Users') {
    return (
      <div className="dashboard-content">
        <UsersSection onOpenInviteModal={() => setShowInviteModal(true)} />
        {showInviteModal && (
          <InviteUserModal
            accessToken={accessToken}
            currentUser={currentUser}
            onClose={() => setShowInviteModal(false)}
            onInvited={addInvitedUser}
          />
        )}
      </div>
    );
  }

  if (
    activeSection === 'Evaluations' ||
    activeSection === 'Submissions' ||
    activeSection === 'Reviews' ||
    activeSection === 'Assignments'
  ) {
    return (
      <div className="dashboard-content">
        {isTrainee ? (
          activeSection === 'Assignments' ? (
            <TraineeAssignmentsView accessToken={accessToken} />
          ) : (
            <TraineeSubmissionsView accessToken={accessToken} />
          )
        ) : (
          <TrainerEvaluationDashboard accessToken={accessToken} currentUser={currentUser} />
        )}
      </div>
    );
  }

  if (activeSection === 'Learning Paths') {
    return (
      <div className="dashboard-content">
        {selectedPathId ? (
          isTrainee ? (
            <TraineeCurriculumView
              learningPathId={selectedPathId}
              learningPathTitle={selectedPathTitle || 'Curriculum Modules'}
              accessToken={accessToken}
              onBack={handleBackToAllPaths}
            />
          ) : (
            <CurriculumManager
              learningPathId={selectedPathId}
              learningPathTitle={selectedPathTitle || 'Curriculum Modules'}
              currentUser={{
                id: currentUser?.id ?? 'user-01',
                role: activeRole as any,
              }}
              accessToken={accessToken}
              onBack={handleBackToAllPaths}
            />
          )
        ) : (
          <LearningPathsSection
            currentUser={{
              id: currentUser?.id ?? 'trainee-99',
              name: currentUser?.firstName ?? 'User',
              role: activeRole as any
            }}
            accessToken={accessToken}
            onNavigateToModules={(pathId: string, pathName: string) => {
              setSelectedPathId(pathId);
              setSelectedPathTitle(pathName);
              if (isTrainee) {
                navigate('/modules');
              }
            }}
            onBackToAllPaths={handleBackToAllPaths}
          />
        )}
      </div>
    );
  }
  if (activeSection === 'Modules' || activeSection === 'Module Details') {
    const pathId = selectedPathId || traineePath?.id || '';
    const pathTitle = selectedPathTitle || traineePath?.title || 'All Modules';

    return (
      <div className="dashboard-content">
        <ModulesManagementSection
          currentPathId={pathId}
          currentPathTitle={pathTitle}
          userRole={activeRole as 'Admin' | 'Trainer' | 'Trainee'}
          accessToken={accessToken}
          onBack={handleBackToAllPaths}
        />
      </div>
    );
  }

  if (activeSection === 'Progress' || activeSection === 'Analytics') {
  return (
    <div className="dashboard-content">
      <ProgressAnalyticsSection
        accessToken={accessToken}
        activeRole={activeRole}
        currentUser={currentUser}
      />
    </div>
  );
}

if (activeSection === 'Settings') {
  return (
    <div className="dashboard-content">
      <SettingsSection accessToken={accessToken} activeRole={activeRole} currentUser={currentUser} />
    </div>
  );
}

// ========================================================
// DEFAULT DASHBOARD HOME (ROLE-ADAPTIVE DB VIEWS)
// ========================================================
const firstName = currentUser.firstName || currentUser.name?.split(' ')[0] || 'User';

if (isTrainee) {
  const currentPathTitle = traineePath?.title || traineePath?.name || 'No path assigned';
  const totalModules = traineePath?.modules?.length || 0;
  const progressPercent = progressStats.completionPercent || dbData.completionRate || 0;
  const completedModules = Math.min(
    totalModules,
    progressStats.completedLessons > 0 && totalModules > 0
      ? Math.max(1, Math.round((progressPercent / 100) * totalModules))
      : 0,
  );

  return (
    <div className="dashboard-content" style={{ padding: '24px 32px', maxWidth: '1320px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Good morning, {firstName}</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', margin: 0 }}>
          You're {progressPercent}% through {currentPathTitle}. Keep the momentum!
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>📖</div>
          <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>{currentPathTitle}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Current Path</div>
          <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, marginTop: '4px' }}>
            Module {completedModules} of {totalModules}
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>🎯</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>{dbData.totalTasks}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Tasks Assigned</div>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginTop: '4px' }}>
            {upcomingTasks.length} upcoming
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>⭐</div>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '12px', color: '#0f172a' }}>{progressPercent}%</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Overall Progress</div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
            {progressStats.completedLessons}/{progressStats.totalLessons} lessons
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>🔥</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
            {dbData.acceptedCount} days
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Accepted Submissions</div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
            {dbData.acceptedCount === 0 ? 'No activity yet' : 'Keep going'}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr 1.3fr', gap: '20px' }}>

        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', position: 'relative' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Learning Path Progress</h3>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
            <div
              style={{ position: 'relative', width: '130px', height: '130px', cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setChartTooltip({
                  visible: true,
                  x: rect.width / 2,
                  y: -10,
                  label: currentPathTitle,
                  value: `${progressPercent}% Complete · ${progressStats.completedLessons}/${progressStats.totalLessons || 1} lessons`,
                });
              }}
              onMouseLeave={() => setChartTooltip((t) => ({ ...t, visible: false }))}
            >
              <svg width="130" height="130" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="10"
                  strokeDasharray="251"
                  strokeDashoffset={251 - (251 * progressPercent) / 100}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{progressPercent}%</span>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Complete</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(traineePath?.modules || []).slice(0, 5).map((m: any, idx: number) => (
              <div key={m.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 6, background: '#fafafa' }}>
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>
                  <span style={{ color: idx < completedModules ? '#16a34a' : '#94a3b8', fontWeight: 700, marginRight: 6 }}>
                    {idx < completedModules ? '✓' : '○'}
                  </span>
                  {m.title || `Module ${idx + 1}`}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: idx < completedModules ? '#dcfce7' : '#f1f5f9', color: idx < completedModules ? '#166534' : '#64748b' }}>
                  {idx < completedModules ? 'Completed' : 'Pending'}
                </span>
              </div>
            ))}
            {(!traineePath?.modules || traineePath.modules.length === 0) && (
              <div style={{ color: '#94a3b8', fontSize: 12 }}>No modules assigned yet.</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9', flex: 1, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Weekly Activity</h3>
              <span style={{ fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 6 }}>
                Active Trend
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 12px 0' }}>
              {progressStats.completedLessons} lessons completed · {dbData.acceptedCount} submissions accepted
            </p>
            <div style={{ height: '110px', position: 'relative' }}>
              {(() => {
                const points = [
                  { x: 15, y: 55, label: 'Mon', lessons: 1, subs: 1 },
                  { x: 50, y: 30, label: 'Tue', lessons: 2, subs: 1 },
                  { x: 85, y: 45, label: 'Wed', lessons: 1, subs: 2 },
                  { x: 120, y: 15, label: 'Thu', lessons: 3, subs: 2 },
                  { x: 155, y: 40, label: 'Fri', lessons: 2, subs: 3 },
                  { x: 185, y: 25, label: 'Sat', lessons: 4, subs: 3 },
                ];
                return (
                  <svg width="100%" height="100%" viewBox="0 0 200 75" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="traineeLineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 15 55 Q 50 30, 85 45 T 155 40 T 185 25 L 185 75 L 15 75 Z"
                      fill="url(#traineeLineGrad)"
                    />
                    <path
                      d="M 15 55 Q 50 30, 85 45 T 155 40 T 185 25"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {points.map((pt, i) => (
                      <g key={i} style={{ cursor: 'pointer' }}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="4"
                          fill="#6366f1"
                          stroke="#fff"
                          strokeWidth="1.5"
                          onMouseEnter={(e) => {
                            const rect = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement)?.getBoundingClientRect();
                            setChartTooltip({
                              visible: true,
                              x: (pt.x / 200) * (rect?.width || 200),
                              y: (pt.y / 75) * (rect?.height || 75) - 20,
                              label: `${pt.label} Activity`,
                              value: `${pt.lessons} lesson${pt.lessons > 1 ? 's' : ''} · ${pt.subs} submission${pt.subs > 1 ? 's' : ''}`,
                            });
                          }}
                          onMouseLeave={() => setChartTooltip((t) => ({ ...t, visible: false }))}
                        />
                      </g>
                    ))}
                  </svg>
                );
              })()}
              {chartTooltip.visible && (
                <div
                  style={{
                    position: 'absolute',
                    left: Math.min(Math.max(chartTooltip.x - 40, 0), 160),
                    top: Math.max(chartTooltip.y - 30, -10),
                    background: '#0f172a',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '5px 9px',
                    borderRadius: 6,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  }}
                >
                  <div style={{ color: '#818cf8', fontSize: 10 }}>{chartTooltip.label}</div>
                  <div>{chartTooltip.value}</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '12px', color: '#64748b' }}>Latest Feedback</strong>
              <span style={{ fontSize: 10, fontWeight: 700, color: dbData.averageScore >= 75 ? '#16a34a' : '#ea580c', background: dbData.averageScore >= 75 ? '#dcfce7' : '#fff7ed', padding: '2px 6px', borderRadius: 4 }}>
                {dbData.averageScore >= 75 ? 'Excellent' : 'In Progress'}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#334155', margin: '6px 0 0 0', fontStyle: 'italic' }}>
              {dbData.averageScore > 0
                ? `Latest average evaluation score: ${dbData.averageScore}/100`
                : 'No evaluation feedback in database yet.'}
            </p>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Upcoming Tasks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(upcomingTasks.length > 0 ? upcomingTasks : []).map((task, idx) => (
              <div key={task.id || idx} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '12px', color: '#1e293b', display: 'block' }}>{task.title}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>⏱️ {task.due || 'Due Soon'}</span>
                </div>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, background: task.priority === 'high' ? '#fee2e2' : '#fef3c7', color: task.priority === 'high' ? '#dc2626' : '#b45309' }}>
                  {task.priority ? task.priority.toUpperCase() : 'MEDIUM'}
                </span>
              </div>
            ))}
            {upcomingTasks.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No upcoming tasks in database.</div>
            )}
          </div>
        </div>

      </section>
    </div>
  );
}

// 🔵 B. TRAINER / ADMIN DASHBOARD VIEW
return (
  <div className="dashboard-content" style={{ padding: '24px 32px', maxWidth: '1320px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

    <section className="workspace-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Good morning, {firstName}</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', margin: 0 }}>
          {isAdmin ? 'System overview: Total active learning paths, user roles & review pipelines.' : "Here's what's happening in your cohort today."}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>

        {isAdmin ? (
          <button
            className="primary-button"
            type="button"
            style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => setShowInviteModal(true)}
          >
            + Add User
          </button>
        ) : (
          <button></button>
        )}
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontSize: '18px' }}>👥</div>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>↗</span>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
          {isLoadingMetrics ? '...' : dbData.totalTrainees}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Total Trainees</div>
        <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '6px' }}>
          {dbData.totalTrainers} trainers
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', fontSize: '18px' }}>📋</div>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>↗</span>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
          {isLoadingMetrics ? '...' : dbData.totalTasks}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Active Assignments</div>
        <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '6px' }}>{dbData.totalModules} modules live</div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c', fontSize: '18px' }}>⏱️</div>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>↗</span>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
          {isLoadingMetrics ? '...' : dbData.pendingReviews}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Pending Reviews</div>
        <div style={{ fontSize: '11px', color: '#ea580c', fontWeight: 600, marginTop: '6px' }}>Needs Trainer action</div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', fontSize: '18px' }}>📈</div>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>↗</span>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
          {isLoadingMetrics ? '...' : `${dbData.completionRate}%`}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Completion Rate</div>
        <div style={{ fontSize: '11px', color: completionGrowth >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600, marginTop: '6px' }}>
          {completionGrowth >= 0 ? '+' : ''}{completionGrowth}% vs last month
        </div>
      </div>

    </section>

    <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Progress Trends</h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>Submissions vs Completions from database</p>
          </div>
        </div>

        {(() => {
          const labels = charts.progressTrends.map((p) => p.label);
          const subs = charts.progressTrends.map((p) => p.submissions);
          const comps = charts.progressTrends.map((p) => p.completions);
          const hasData = subs.some((v) => v > 0) || comps.some((v) => v > 0);
          const subPath = seriesToPolyline(hasData ? subs : [0, 0, 0, 0, 0, 0], 500, 180, 40, 20);
          const compPath = seriesToPolyline(hasData ? comps : [0, 0, 0, 0, 0, 0], 500, 180, 40, 20);
          const area = seriesToAreaPath(hasData ? subs : [0, 0, 0, 0, 0, 0], 500, 180, 40, 20);
          const yMax = Math.max(subPath.max, compPath.max, 1);
          return (
            <div style={{ position: 'relative', width: '100%', height: '180px' }}>
              <svg width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="40" y1="60" x2="480" y2="60" stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="40" y1="100" x2="480" y2="100" stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="40" y1="140" x2="480" y2="140" stroke="#f1f5f9" strokeDasharray="3 3" />
                <text x="8" y="24" fill="#94a3b8" fontSize="10">{yMax}</text>
                <text x="12" y="175" fill="#94a3b8" fontSize="10">0</text>
                <path d={area} fill="url(#purpleGradient)" />
                <path d={subPath.path} fill="none" stroke="#6366f1" strokeWidth="2.5" />
                <path d={compPath.path} fill="none" stroke="#10b981" strokeWidth="2.5" />
                {subPath.coords.map((c, i) => (
                  <circle
                    key={`s-${i}`}
                    cx={c.x}
                    cy={c.y}
                    r="5"
                    fill="#6366f1"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      const rect = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement)?.getBoundingClientRect();
                      setChartTooltip({
                        visible: true,
                        x: e.clientX - (rect?.left || 0),
                        y: e.clientY - (rect?.top || 0) - 12,
                        label: labels[i] || `W${i + 1}`,
                        value: `Submissions: ${subs[i] ?? 0} · Completions: ${comps[i] ?? 0}`,
                      });
                    }}
                    onMouseLeave={() => setChartTooltip((t) => ({ ...t, visible: false }))}
                  />
                ))}
              </svg>
              {chartTooltip.visible && (
                <div
                  style={{
                    position: 'absolute',
                    left: Math.min(Math.max(chartTooltip.x, 8), 360),
                    top: Math.max(chartTooltip.y - 36, 4),
                    background: '#0f172a',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '6px 10px',
                    borderRadius: 8,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    zIndex: 5,
                    boxShadow: '0 4px 14px rgba(15,23,42,0.25)',
                  }}
                >
                  <div>{chartTooltip.label}</div>
                  <div style={{ fontWeight: 500, opacity: 0.9 }}>{chartTooltip.value}</div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '40px', paddingRight: '20px', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                {(labels.length ? labels : ['—']).map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
              {!hasData && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  0 submissions · 0% growth
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Avg. Evaluation Score</h3>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>Weekly average from database</p>

        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a' }}>{dbData.averageScore}</span>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>/100</span>
        </div>

        {(() => {
          const scores = charts.weeklyScores.map((w) => w.averageScore);
          const labels = charts.weeklyScores.map((w) => w.label);
          const hasData = scores.some((v) => v > 0);
          const line = seriesToPolyline(hasData ? scores : [0, 0, 0, 0, 0, 0], 240, 90, 10, 10);
          return (
            <div style={{ marginTop: '20px', height: '100px', position: 'relative' }}>
              <svg width="100%" height="100%" viewBox="0 0 240 90">
                <line x1="10" y1="20" x2="230" y2="20" stroke="#f1f5f9" strokeDasharray="2 2" />
                <line x1="10" y1="50" x2="230" y2="50" stroke="#f1f5f9" strokeDasharray="2 2" />
                <path d={line.path} fill="none" stroke="#6366f1" strokeWidth="2" />
                {line.coords.map((c, i) => (
                  <circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r="4"
                    fill="#6366f1"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() =>
                      setChartTooltip({
                        visible: true,
                        x: c.x,
                        y: c.y,
                        label: labels[i] || `W${i + 1}`,
                        value: `Score: ${scores[i] ?? 0}`,
                      })
                    }
                    onMouseLeave={() => setChartTooltip((t) => ({ ...t, visible: false }))}
                  >
                    <title>{`${labels[i] || `W${i + 1}`}: ${scores[i] ?? 0}`}</title>
                  </circle>
                ))}
              </svg>
              {chartTooltip.visible && chartTooltip.value.startsWith('Score:') && (
                <div
                  style={{
                    position: 'absolute',
                    left: Math.min(chartTooltip.x, 160),
                    top: Math.max(chartTooltip.y - 28, 0),
                    background: '#0f172a',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '5px 8px',
                    borderRadius: 6,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {chartTooltip.label} — {chartTooltip.value}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                {(charts.weeklyScores.length ? charts.weeklyScores : [{ label: 'W1' }, { label: 'W2' }, { label: 'W3' }, { label: 'W4' }, { label: 'W5' }, { label: 'W6' }]).map((w: any) => (
                  <span key={w.label}>{w.label}</span>
                ))}
              </div>
              {!hasData && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  0/100 · no scores yet
                </div>
              )}
            </div>
          );
        })()}
      </div>

    </section>

    <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Recent Submissions</h3>
        {pendingSubmissions.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '13px' }}>No pending submissions in database queue.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingSubmissions.slice(0, 5).map((sub) => (
              <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #f8fafc', borderRadius: '8px', background: '#fafafa' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: '#1e293b' }}>{sub.trainee?.firstName || sub.trainee?.name || 'Trainee'}</strong>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{sub.assignment?.title || 'Assignment Task'}</div>
                </div>
                <span style={{ padding: '6px 14px', borderRadius: '6px', background: '#fef3c7', color: '#b45309', fontWeight: 600, fontSize: '12px' }}>
                  {sub.status || 'Pending Review'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0' }}>Quick Actions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{dbData.pendingReviews} submissions awaiting review</span>
            <button type="button" style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }} onClick={() => (window.location.href = '/evaluations')}>Review Now</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{dbData.totalTrainees} trainees · {dbData.totalPaths} paths</span>
            <button type="button" style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }} onClick={() => (window.location.href = '/users')}>View Users</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{dbData.totalPaths} learning paths</span>
            <button type="button" style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }} onClick={() => (window.location.href = '/learning-paths')}>Edit Paths</button>
          </div>
        </div>
      </div>
    </section>

    {showInviteModal && (
      <InviteUserModal
        accessToken={accessToken}
        currentUser={currentUser}
        onClose={() => setShowInviteModal(false)}
        onInvited={addInvitedUser}
      />
    )}
  </div>
);
}