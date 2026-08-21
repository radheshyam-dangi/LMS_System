import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
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
import { DailyActivityHeatmap } from '../components/DailyActivityHeatmap/DailyActivityHeatmap';
import { NotificationsSection } from '../components/NotificationsSection/NotificationsSection';
import type { RoleName, SessionUser } from '../types/auth';
import confetti from 'canvas-confetti';
import { DashboardCharts } from '../components/DashboardCharts/DashboardCharts';

const calculateStreak = (activityTimestamps: string[]) => {
  if (!activityTimestamps || activityTimestamps.length === 0) return { streak: 0, activeToday: false };
  
  const toLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  
  const dates = new Set<string>();
  activityTimestamps.forEach(ts => {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      dates.add(toLocalDateStr(d));
    }
  });

  let streak = 0;
  let current = new Date();
  
  const todayStr = toLocalDateStr(current);
  const activeToday = dates.has(todayStr);

  if (!activeToday) {
    // If not today, check yesterday
    current.setDate(current.getDate() - 1);
    if (!dates.has(toLocalDateStr(current))) {
      return { streak: 0, activeToday: false };
    }
  }

  // Count backwards from current
  while (true) {
    const key = toLocalDateStr(current);
    if (dates.has(key)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }
  return { streak, activeToday };
};

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

function useAnimatedValue(targetValue: number, duration: number = 800) {
  const [value, setValue] = useState(0);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setValue(targetValue);
      prevTargetRef.current = targetValue;
      return;
    }

    const startValue = prevTargetRef.current;
    if (startValue === targetValue) {
      setValue(targetValue);
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentVal = Math.round(startValue + (targetValue - startValue) * easeProgress);
      setValue(currentVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        prevTargetRef.current = targetValue;
      }

    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [targetValue, duration]);

  return value;
}

function TraineeProgressRing({ 
  progressPercent, 
  currentPathTitle,
  onPathClick,
  completedLessons,
  totalLessons
}: { 
  progressPercent: number; 
  currentPathTitle: string; 
  onPathClick: () => void;
  completedLessons: number;
  totalLessons: number;
}) {
  const animatedPercent = useAnimatedValue(progressPercent, 1000);
  const [strokeOffset, setStrokeOffset] = useState(251); // 251 is full circumference
  const [showTooltip, setShowTooltip] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetOffset = 251 - (251 * progressPercent) / 100;
    
    if (prefersReducedMotion) {
      setStrokeOffset(targetOffset);
    } else {
      // Trigger animation slightly after mount
      const timer = setTimeout(() => {
        setStrokeOffset(targetOffset);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [progressPercent]);

  useEffect(() => {
    if (progressPercent === 100) {
      const timer = setTimeout(() => setShowCheckmark(true), 800);
      return () => clearTimeout(timer);
    } else {
      setShowCheckmark(false);
    }
  }, [progressPercent]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
      <div
        style={{ position: 'relative', width: '130px', height: '130px', cursor: 'pointer', outline: 'none' }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        onClick={onPathClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPathClick(); }}
        tabIndex={0}
        role="button"
        aria-label={`${currentPathTitle}: ${progressPercent}% complete`}
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
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {showCheckmark ? (
            <div style={{
              fontSize: '32px', color: '#10b981', 
              animation: 'popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}>✓</div>
          ) : (
            <>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{animatedPercent}%</span>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Complete</span>
            </>
          )}
        </div>
        
        {/* CSS for popIn animation (inlined for safety) */}
        <style>{`
          @keyframes popIn {
            0% { transform: scale(0); opacity: 0; }
            70% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {showTooltip && (
          <div style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0f172a',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'none'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{currentPathTitle} — {progressPercent}% complete</div>
            <div style={{ color: '#cbd5e1' }}>{completedLessons} of {totalLessons || 1} lessons completed</div>
            {/* Tooltip triangle */}
            <div style={{
              position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
              borderTop: '4px solid #0f172a'
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

function StreakCard({ currentStreak, activeToday, onCelebrate }: { currentStreak: number; activeToday: boolean; onCelebrate: (val: number) => void }) {
  const animatedStreak = useAnimatedValue(currentStreak, 800);
  const flameRef = useRef<HTMLDivElement>(null);
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    const toLocalDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    
    const todayStr = toLocalDateStr(new Date());
    const lsKey = 'lastStreakCelebrationDate_v3';
    const lastCelDate = localStorage.getItem(lsKey);

    // We celebrate ONLY if:
    // 1. Streak is > 0
    // 2. The trainee was ACTIVE TODAY (they completed a task/lesson today)
    // 3. We have NOT celebrated today yet.
    if (currentStreak > 0 && activeToday && lastCelDate !== todayStr) {
      localStorage.setItem(lsKey, todayStr);
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      setBounce(true);
      setTimeout(() => setBounce(false), 300);

      // Check milestones
      let particleCount = 20;
      if (currentStreak === 7) { setMilestoneMsg("7-day streak! 🔥"); particleCount = 35; }
      else if (currentStreak === 30) { setMilestoneMsg("30-day streak! 🏆"); particleCount = 40; }
      else if (currentStreak === 100) { setMilestoneMsg("100-day streak! 💎"); particleCount = 50; }
      else { setMilestoneMsg(null); }

      // Fire confetti from flame
      if (!prefersReducedMotion && flameRef.current) {
        const rect = flameRef.current.getBoundingClientRect();
        const originX = (rect.left + rect.width / 2) / window.innerWidth;
        const originY = (rect.top + rect.height / 2) / window.innerHeight;
        
        confetti({
          particleCount,
          spread: 50,
          origin: { x: originX, y: originY },
          colors: ['#4f46e5', '#ea580c', '#10b981', '#ec4899'],
          zIndex: 9999
        });
      }
      onCelebrate(currentStreak);
    }
  }, [currentStreak, activeToday, onCelebrate]);

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
      <div 
        ref={flameRef}
        style={{ 
          width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a',
          transform: bounce ? 'scale(1.3)' : 'scale(1)',
          transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
        🔥
      </div>
      <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
        {animatedStreak} days
      </div>
      <div style={{ fontSize: '12px', color: '#64748b' }}>Current Streak</div>
      <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
        {milestoneMsg ? milestoneMsg : (currentStreak === 0 ? 'Submit a task to start!' : 'Keep it up!')}
      </div>
    </div>
  );
}



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
  const location = useLocation();
  const [selectedPathId, setSelectedPathId] = useState<string | null>((location.state as any)?.pathId || null);
  const [selectedPathTitle, setSelectedPathTitle] = useState<string>((location.state as any)?.pathName || '');
  const [heatmapRange, setHeatmapRange] = useState<number>(() => {
    const saved = sessionStorage.getItem('dailyActivityRange');
    return saved ? parseInt(saved, 10) : 30;
  });

  useEffect(() => {
    sessionStorage.setItem('dailyActivityRange', heatmapRange.toString());
  }, [heatmapRange]);

  useEffect(() => {
    const state = location.state as any;
    if (state?.pathId) {
      setSelectedPathId(state.pathId);
      setSelectedPathTitle(state.pathName || '');
    }
  }, [location.state]);

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
    currentStreak: 0,
    activityTimestamps: [] as string[],
  });

  const [traineePath, setTraineePath] = useState<any | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [progressStats, setProgressStats] = useState<any>({
    completedLessons: 0,
    totalLessons: 0,
    completionPercent: 0,
    averageScore: 0,
    completedModuleIds: [],
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
            averageScore: 0,
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
        const acceptedCount = (mySubs || []).filter((s: any) => s.status === 'Approved').length;
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
          currentStreak: analytics?.currentStreak ?? 0,
          activityTimestamps: (analytics as any)?.activityTimestamps || [],
        });

        setPendingSubmissions(pendingSubs || analytics?.recentActivity || []);
        setMySubmissions(mySubs || []);

        if (isTrainee && pathsList?.length > 0) {
          let assigned = null;
          if (mySubs && mySubs.length > 0) {
            // Find most recent submission's learning path
            for (const sub of mySubs) {
              const pId = sub.assignment?.learningPath?.id || (sub.assignment as any)?.learningPathId;
              if (pId) {
                assigned = pathsList.find((p: any) => p.id === pId);
                if (assigned) break;
              }
            }
          }
          if (!assigned) {
             assigned = pathsList.find((p: any) => p.assignedToTraineeIds?.includes(currentUser.id));
          }
          setTraineePath(assigned);
          setUpcomingTasks([]);
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
            currentStreak: 0,
            activityTimestamps: [],
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
  }, [accessToken, activeRole, currentUser.id, isTrainee, activeSection]);

  // ========================================================
  // ROUTING ENGINE VIEW CONDITIONALS 
  // ========================================================

  if (isAdmin && activeSection === 'Users') {
    return (
      <div className="dashboard-content">
        <UsersSection onOpenInviteModal={() => setShowInviteModal(true)} accessToken={accessToken} />
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
            <TraineeAssignmentsView accessToken={accessToken} currentUser={currentUser} />
          ) : (
            <TraineeSubmissionsView accessToken={accessToken} />
          )
        ) : (
          <TrainerEvaluationDashboard accessToken={accessToken} currentUser={currentUser} />
        )}
      </div>
    );
  }

  if (activeSection === 'Notifications') {
    return (
      <div className="dashboard-content">
        <NotificationsSection />
      </div>
    );
  }

  if (activeSection === 'Learning Paths') {
    return (
      <div className="dashboard-content">
        {selectedPathId && !isTrainee ? (
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
        ) : (
          <LearningPathsSection
            currentUser={{
              id: currentUser?.id ?? 'trainee-99',
              name: currentUser?.firstName ?? 'User',
              role: activeRole as any
            }}
            accessToken={accessToken}
            onNavigateToModules={(pathId: string, pathName: string) => {
              if (isTrainee) {
                navigate('/modules', { state: { pathId, pathName } });
              } else {
                setSelectedPathId(pathId);
                setSelectedPathTitle(pathName);
              }
            }}
            onBackToAllPaths={handleBackToAllPaths}
          />
        )}
      </div>
    );
  }
  if (activeSection === 'Modules' || activeSection === 'Module Details') {
    const pathId = location.state?.pathId || selectedPathId || traineePath?.id || '';
    const pathTitle = location.state?.pathName || selectedPathTitle || traineePath?.title || 'All Modules';

    if (!isTrainee) {
      if (!pathId) {
        return <Navigate to="/learning-paths" replace />;
      }
      return (
        <div className="dashboard-content">
          <CurriculumManager
            learningPathId={pathId}
            learningPathTitle={pathTitle}
            currentUser={{ id: currentUser!.id, role: activeRole as 'Admin' | 'Trainer' | 'Trainee' }}
            accessToken={accessToken}
            onBack={handleBackToAllPaths}
          />
        </div>
      );
    }

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

  // Use exact lessons completion % as overall progress
  const progressPercent = progressStats.totalLessons > 0 ? Math.round((progressStats.completedLessons / progressStats.totalLessons) * 100) : 0;

  
  const combinedTimestamps = [
    ...(dbData.activityTimestamps || []),
    ...mySubmissions.map(s => s.submittedAt || s.createdAt)
  ];
  const { streak: currentStreak, activeToday } = calculateStreak(combinedTimestamps);


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
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>⭐</div>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '12px', color: '#0f172a' }}>{progressPercent}%</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Overall Progress</div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
            {progressStats.completedLessons}/{progressStats.totalLessons} lessons
          </div>
        </div>

        <StreakCard 
          currentStreak={currentStreak} 
          activeToday={activeToday}
          onCelebrate={(val) => {
            analyticsService.celebrateStreak(val, accessToken).catch(console.error);
            setDbData(prev => ({...prev, currentStreak: val}));
          }} 
        />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>Daily Activity</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Submissions and activity</p>
              </div>
              <select 
                value={heatmapRange}
                onChange={(e) => setHeatmapRange(Number(e.target.value))}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', background: '#fff', outline: 'none', cursor: 'pointer' }}
              >
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
                <option value={120}>Last 120 days</option>
                <option value={240}>Last 240 days</option>
                <option value={365}>Last 365 days</option>
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '16px 0', overflowX: 'auto', minHeight: '180px' }}>
              <DailyActivityHeatmap submissions={mySubmissions} daysToDispay={heatmapRange} />
            </div>
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
  <DashboardCharts
    title="Progress Trends"
    subtitle="Submissions vs Completions from database"
    role={activeRole.toLowerCase()}
    type="progress"
    accessToken={accessToken}
  />
  <DashboardCharts
    title="Avg. Evaluation Score"
    subtitle="Weekly average from database"
    role={activeRole.toLowerCase()}
    type="score"
    accessToken={accessToken}
  />
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