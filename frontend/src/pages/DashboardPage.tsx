import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Flame,
  Award,
  CheckCircle2,
  Zap,
  Compass,
  Users,
  BookOpen,
  Clock,
  ArrowRight,
  ChevronRight,
  Calendar,
  Activity,
  Layers,
  BarChart2,
  AlertCircle,
  Plus,
  ClipboardList,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { TrainerTraineeDetail } from './TrainerTraineeDetail';
import { InviteUserModal } from '../components/users/InviteUserModal';
import { UsersSection } from '../components/users/UserManagement';
import { LearningPathsSection } from '../components/LearningPathsSection/LearningPathsSection';
import { CurriculumManager } from '../components/CurriculumManager/CurriculumManager';
import { TraineeCurriculumView } from '../components/TraineeSubmissionsView/TraineeCurriculumView';
import { TrainerEvaluationDashboard } from '../components/TrainerEvaluationDashboard/TrainerEvaluationDashboard';
import { useScrollLock } from '../hooks/useScrollLock';
import './DashboardPage.css';
import { TraineeSubmissionsView } from '../components/TraineeSubmissionsView/TraineeSubmissionsView';
import { TraineeAssignmentsView } from '../components/TraineeSubmissionsView/TraineeAssignmentsView';
import { ProgressAnalyticsSection } from '../components/ProgressAnalyticsSection/ProgressAnalyticsSection';
import { SettingsSection } from '../components/SettingsSection/SettingsSection';
import { userService } from '../services/userService';
import { learningPathService } from '../services/learningPathService';
import { assignmentService } from '../services/assignmentService';
import { analyticsService, progressService, type ChartBundle } from '../services/lmsApi';
import { ModulesManagementSection } from '../components/ModulePathSection/ModulesManagementSection';
import { useNotifications } from '../context/NotificationContext';
import { DailyActivityHeatmap } from '../components/DailyActivityHeatmap/DailyActivityHeatmap';
import { NotificationsPage } from './NotificationsPage';
import { NotificationsSection } from '../components/NotificationsSection/NotificationsSection';
import type { RoleName, SessionUser } from '../types/auth';
import confetti from 'canvas-confetti';
import { DashboardCharts } from '../components/DashboardCharts/DashboardCharts';
import { InteractiveTraineeProgress } from '../components/DashboardCharts/InteractiveTraineeProgress';
import { TraineeHeroCard } from '../components/TraineeDashboardWidgets/TraineeDashboardWidgets';
import {
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

const truncateLabel = (name: string, maxLen = 14) => {
  if (!name) return '';
  return name.length > maxLen ? name.slice(0, maxLen).trim() + '…' : name;
};

const fmt = (v: number): string => {
  if (!Number.isFinite(v)) return '0';
  return String(Math.round(v));
};

const CustomXAxisTick = ({ x, y, payload }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text x={0} y={0} dy={16} textAnchor="end" fill="#64748b" fontSize={11.5} fontWeight={500} transform="rotate(-25)">
        {truncateLabel(payload.value, 15)}
      </text>
    </g>
  );
};

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
    current.setDate(current.getDate() - 1);
    if (!dates.has(toLocalDateStr(current))) {
      return { streak: 0, activeToday: false };
    }
  }

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

const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatSubmissionTime = (dateStr?: string): string => {
  if (!dateStr) return 'Recently';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getInitials = (name?: string): string => {
  if (!name) return 'TR';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarBg = (name?: string): string => {
  const colors = [
    '#e0e7ff', // indigo
    '#dbeafe', // blue
    '#fae8ff', // fuchsia
    '#fef3c7', // amber
    '#dcfce7', // emerald
    '#ffedd5', // orange
    '#f3e8ff', // purple
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getAvatarColor = (name?: string): string => {
  const colors = [
    '#4338ca', // indigo
    '#1d4ed8', // blue
    '#a21caf', // fuchsia
    '#b45309', // amber
    '#15803d', // emerald
    '#c2410c', // orange
    '#7e22ce', // purple
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
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

// ---------------------------------------------------------
// Modern Executive MetricCard Component
// ---------------------------------------------------------
interface MetricCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
  hint: string;
  hintType?: 'positive' | 'neutral' | 'warning' | 'negative';
  trend?: string;
  progressPercent?: number;
  onClick?: () => void;
  actionText?: string;
}

function MetricCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  hint,
  hintType = 'neutral',
  trend,
  progressPercent,
  onClick,
  actionText,
}: MetricCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      className={`db-metric-card ${isClickable ? 'db-metric-card-interactive' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="db-metric-card-header">
        <div className="db-metric-icon" style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {trend && (
            <span className={`db-metric-trend-badge ${hintType}`}>
              {trend}
            </span>
          )}
          {isClickable && actionText && (
            <span className="db-metric-action-link">
              <span>{actionText}</span>
              <ChevronRight size={13} />
            </span>
          )}
        </div>
      </div>
      <div className="db-metric-value">{value}</div>
      <div className="db-metric-label">{label}</div>
      {typeof progressPercent === 'number' && (
        <div className="db-metric-mini-bar">
          <div
            className="db-metric-mini-fill"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%`, backgroundColor: iconColor }}
          />
        </div>
      )}
      <div className={`db-metric-hint ${hintType}`}>{hint}</div>
    </div>
  );
}

// ---------------------------------------------------------
// Interactive StreakCard with Confetti Celebration
// ---------------------------------------------------------
function StreakCard({
  currentStreak,
  activeToday,
  onCelebrate,
}: {
  currentStreak: number;
  activeToday: boolean;
  onCelebrate: (val: number) => void;
}) {
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

    if (currentStreak > 0 && activeToday && lastCelDate !== todayStr) {
      localStorage.setItem(lsKey, todayStr);
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      setBounce(true);
      setTimeout(() => setBounce(false), 300);

      let particleCount = 20;
      if (currentStreak === 7) {
        setMilestoneMsg('7-day streak achieved');
        particleCount = 35;
      } else if (currentStreak === 30) {
        setMilestoneMsg('30-day streak achieved');
        particleCount = 40;
      } else if (currentStreak === 100) {
        setMilestoneMsg('100-day streak achieved');
        particleCount = 50;
      } else {
        setMilestoneMsg(null);
      }

      if (!prefersReducedMotion && flameRef.current) {
        const rect = flameRef.current.getBoundingClientRect();
        const originX = (rect.left + rect.width / 2) / window.innerWidth;
        const originY = (rect.top + rect.height / 2) / window.innerHeight;

        confetti({
          particleCount,
          spread: 50,
          origin: { x: originX, y: originY },
          colors: ['#4f46e5', '#ea580c', '#10b981', '#ec4899'],
          zIndex: 9999,
        });
      }
      onCelebrate(currentStreak);
    }
  }, [currentStreak, activeToday, onCelebrate]);

  return (
    <div className="db-metric-card">
      <div className="db-metric-card-header">
        <div
          ref={flameRef}
          className="db-metric-icon"
          style={{
            backgroundColor: '#fff7ed',
            color: '#ea580c',
            transform: bounce ? 'scale(1.25)' : 'scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
        >
          <Flame size={19} strokeWidth={1.75} />
        </div>
      </div>
      <div className="db-metric-value">{animatedStreak} days</div>
      <div className="db-metric-label">Current Streak</div>
      <div className="db-metric-hint positive">
        {milestoneMsg ? milestoneMsg : currentStreak === 0 ? 'Submit task to start!' : 'Keep it up!'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Dashboard Skeleton Loading Screen
// ---------------------------------------------------------
function DashboardSkeleton({ isTrainee = true, isAdmin = false }: { isTrainee?: boolean; isAdmin?: boolean }) {
  const cardCount = isTrainee ? 6 : isAdmin ? 4 : 4;
  return (
    <div className="db-container dashboard-content">
      {/* Header Skeleton */}
      <div className="db-header">
        <div className="db-header-title-wrap">
          <div className="db-skeleton-shimmer" style={{ width: '220px', height: '32px', marginBottom: '8px' }} />
          <div className="db-skeleton-shimmer" style={{ width: '320px', height: '16px' }} />
        </div>
      </div>

      {/* Hero Banner Skeleton (Trainee) */}
      {isTrainee && (
        <div className="db-skeleton-shimmer db-skeleton-hero" />
      )}

      {/* Metric Cards Skeleton Grid */}
      <div className={`db-metrics-grid ${isAdmin ? 'admin-grid' : ''}`}>
        {Array.from({ length: cardCount }).map((_, idx) => (
          <div key={idx} className="db-skeleton-metric-card">
            <div className="db-skeleton-shimmer" style={{ width: '38px', height: '38px', borderRadius: '11px' }} />
            <div className="db-skeleton-shimmer" style={{ width: '90px', height: '28px', marginTop: '6px' }} />
            <div className="db-skeleton-shimmer" style={{ width: '120px', height: '14px' }} />
            <div className="db-skeleton-shimmer" style={{ width: '75px', height: '12px', marginTop: '4px' }} />
          </div>
        ))}
      </div>

      {/* Split Row Upper Skeleton */}
      <div className="db-layout-row-upper">
        <div className="db-panel" style={{ height: '410px' }}>
          <div className="db-skeleton-shimmer" style={{ width: '180px', height: '22px', marginBottom: '8px' }} />
          <div className="db-skeleton-shimmer" style={{ width: '260px', height: '14px', marginBottom: '24px' }} />
          <div className="db-skeleton-shimmer" style={{ flex: 1, width: '100%', borderRadius: '12px' }} />
        </div>
        <div className="db-panel" style={{ height: '410px' }}>
          <div className="db-skeleton-shimmer" style={{ width: '160px', height: '22px', marginBottom: '8px' }} />
          <div className="db-skeleton-shimmer" style={{ width: '220px', height: '14px', marginBottom: '24px' }} />
          <div className="db-skeleton-shimmer" style={{ width: '100%', height: '230px', borderRadius: '12px', marginBottom: '16px' }} />
          <div className="db-skeleton-shimmer" style={{ width: '100%', height: '40px', borderRadius: '8px' }} />
        </div>
      </div>

      {/* Split Row Lower Skeleton */}
      <div className="db-layout-row-lower">
        <div className="db-panel" style={{ height: '360px' }}>
          <div className="db-skeleton-shimmer" style={{ width: '180px', height: '20px', marginBottom: '8px' }} />
          <div className="db-skeleton-shimmer" style={{ width: '100%', height: '40px', borderRadius: '8px', marginBottom: '16px' }} />
          <div className="db-skeleton-shimmer" style={{ flex: 1, width: '100%', borderRadius: '12px' }} />
        </div>
        <div className="db-panel" style={{ height: '360px' }}>
          <div className="db-skeleton-shimmer" style={{ width: '220px', height: '20px', marginBottom: '16px' }} />
          <div className="db-skeleton-shimmer" style={{ flex: 1, width: '100%', borderRadius: '12px' }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Dedicated Trainer Dashboard Skeleton Loading Screen
// ---------------------------------------------------------
function TrainerDashboardSkeleton({ firstName = 'Trainer' }: { firstName?: string }) {
  return (
    <div className="db-container dashboard-content">
      {/* Header Skeleton */}
      <div className="db-header">
        <div className="db-header-left">
          <div className="db-header-title-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="db-skeleton-shimmer" style={{ width: '240px', height: '32px' }} />
              <div className="db-skeleton-shimmer" style={{ width: '85px', height: '24px', borderRadius: '999px' }} />
            </div>
            <div className="db-skeleton-shimmer" style={{ width: '380px', height: '16px', marginTop: '6px' }} />
          </div>
        </div>
        <div className="db-header-actions">
          <div className="db-skeleton-shimmer" style={{ width: '145px', height: '40px', borderRadius: '10px' }} />
          <div className="db-skeleton-shimmer" style={{ width: '175px', height: '40px', borderRadius: '10px' }} />
        </div>
      </div>

      {/* 5-Card Metrics Grid Skeleton */}
      <div className="db-metrics-grid trainer-grid">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="db-skeleton-metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="db-skeleton-shimmer" style={{ width: '40px', height: '40px', borderRadius: '11px' }} />
              <div className="db-skeleton-shimmer" style={{ width: '65px', height: '20px', borderRadius: '999px' }} />
            </div>
            <div className="db-skeleton-shimmer" style={{ width: '70px', height: '30px', marginTop: '4px' }} />
            <div className="db-skeleton-shimmer" style={{ width: '120px', height: '14px' }} />
            <div className="db-skeleton-shimmer" style={{ width: '100px', height: '12px', marginTop: '4px' }} />
          </div>
        ))}
      </div>

      {/* Cohort Progress Chart Skeleton (Fluid Auto-Sizing) */}
      <div className="db-panel" style={{ minHeight: '360px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div className="db-skeleton-shimmer" style={{ width: '200px', height: '20px', marginBottom: '6px' }} />
            <div className="db-skeleton-shimmer" style={{ width: '280px', height: '14px' }} />
          </div>
          <div className="db-skeleton-shimmer" style={{ width: '120px', height: '32px', borderRadius: '6px' }} />
        </div>
        {/* Simulated Bar Chart Silhouette */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', height: '220px', padding: '0 20px', borderBottom: '1px solid #f1f5f9' }}>
          {[65, 85, 40, 95, 70, 50, 80].map((h, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                className="db-skeleton-shimmer"
                style={{ width: '100%', maxWidth: '50px', height: `${h}%`, borderRadius: '6px 6px 0 0' }}
              />
              <div className="db-skeleton-shimmer" style={{ width: '36px', height: '10px' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="db-skeleton-shimmer" style={{ width: '80px', height: '14px', borderRadius: '4px' }} />
          ))}
        </div>
      </div>

      {/* Split Row: Submissions Queue & Quick Actions Skeleton */}
      <div className="db-layout-split">
        {/* Submissions Panel Skeleton */}
        <div className="db-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div className="db-skeleton-shimmer" style={{ width: '180px', height: '20px' }} />
            <div className="db-skeleton-shimmer" style={{ width: '70px', height: '20px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #f1f5f9',
                  background: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="db-skeleton-shimmer" style={{ width: '38px', height: '38px', borderRadius: '50%' }} />
                  <div>
                    <div className="db-skeleton-shimmer" style={{ width: '110px', height: '14px', marginBottom: '6px' }} />
                    <div className="db-skeleton-shimmer" style={{ width: '160px', height: '12px' }} />
                  </div>
                </div>
                <div className="db-skeleton-shimmer" style={{ width: '90px', height: '24px', borderRadius: '999px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Panel Skeleton */}
        <div className="db-panel">
          <div style={{ marginBottom: '18px' }}>
            <div className="db-skeleton-shimmer" style={{ width: '140px', height: '20px', marginBottom: '4px' }} />
            <div className="db-skeleton-shimmer" style={{ width: '200px', height: '12px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="db-skeleton-shimmer" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
                  <div>
                    <div className="db-skeleton-shimmer" style={{ width: '130px', height: '14px', marginBottom: '4px' }} />
                    <div className="db-skeleton-shimmer" style={{ width: '90px', height: '11px' }} />
                  </div>
                </div>
                <div className="db-skeleton-shimmer" style={{ width: '75px', height: '28px', borderRadius: '8px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// MAIN DASHBOARD PAGE COMPONENT
// ==========================================================================
export function DashboardPage({
  accessToken,
  activeRole,
  activeSection,
  currentUser,
}: DashboardPageProps) {
  const navigate = useNavigate();
  const { refresh: refreshNotifications } = useNotifications();
  const [showInviteModal, setShowInviteModal] = useState(false);
  useScrollLock(showInviteModal);
  const location = useLocation();
  const { pathId: urlPathId } = useParams<{ pathId?: string }>();
  const [selectedPathId, setSelectedPathId] = useState<string | null>(urlPathId || (location.state as any)?.pathId || null);
  const [selectedPathTitle, setSelectedPathTitle] = useState<string>((location.state as any)?.pathName || '');
  const [selectedLpTitle, setSelectedLpTitle] = useState<string | null>(null);
  const [heatmapRange, setHeatmapRange] = useState<number>(() => {
    const saved = sessionStorage.getItem('dailyActivityRange');
    return saved ? parseInt(saved, 10) : 30;
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const prevRoleRef = useRef(activeRole);

  useEffect(() => {
    if (prevRoleRef.current !== activeRole) {
      prevRoleRef.current = activeRole;
      if (searchParams.size > 0) {
        setSearchParams({});
      }
    }
  }, [activeRole, searchParams, setSearchParams]);

  useEffect(() => {
    sessionStorage.setItem('dailyActivityRange', heatmapRange.toString());
  }, [heatmapRange]);

  useEffect(() => {
    const state = location.state as any;
    const queryPathId = searchParams.get('pathId');
    if (state?.pathId) {
      setSelectedPathId(state.pathId);
      setSelectedPathTitle(state.pathName || '');
    } else if (queryPathId) {
      setSelectedPathId(queryPathId);
    } else {
      setSelectedPathId(urlPathId || null);
    }
  }, [location.state, urlPathId, searchParams]);

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
  const [dbData, setDbData] = useState<{
    totalUsers: number;
    totalTrainers: number;
    totalTrainees: number;
    totalPaths: number;
    totalModules: number;
    totalTasks: number;
    pendingReviews: number;
    acceptedCount: number;
    completionRate: number;
    averageScore: number;
    totalLessons: number;
    currentStreak: number;
    activityTimestamps: string[];
    platformTotalTrainees?: number;
    platformTotalTrainers?: number;
    trainerLpsCreated?: number;
    trainerAssignments?: { total: number; internal: number; external: number };
    trainerPendingReviews?: number;
    trainingEffectiveness?: number | null;
    assignedTraineesProgress?: any[];
    tasksCompleted?: number;
    learningVelocity?: number;
    activeEnrollments?: number;
    totalMaxScore?: number;
    totalGainedScore?: number;
    skillGrowth?: number;
  }>({
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

  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [allPaths, setAllPaths] = useState<any[]>([]);
  const [pathProgressSummary, setPathProgressSummary] = useState<Record<string, any>>({});
  const [traineePath, setTraineePath] = useState<any | null>(null);
  const [progressStats, setProgressStats] = useState({
    completedLessons: 0,
    totalLessons: 0,
    completionPercent: 0,
    averageScore: 0,
  });

  const [, setUpcomingTasks] = useState<any[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [charts, setCharts] = useState<ChartBundle | null>(null);

  useEffect(() => {
    if (charts?.moduleCompletion && charts.moduleCompletion.length > 0 && !selectedLpTitle) {
      const lps = Array.from(new Set(charts.moduleCompletion.map((mc: any) => mc.pathTitle).filter(Boolean)));
      let mostRecentLp = '';
      let maxTimestamp = -1;
      charts.moduleCompletion.forEach((mc: any) => {
        if (mc.lastActivity !== undefined && mc.lastActivity > maxTimestamp) {
          maxTimestamp = mc.lastActivity;
          mostRecentLp = mc.pathTitle;
        }
      });
      if (!mostRecentLp) mostRecentLp = lps[0] as string;
      setSelectedLpTitle(mostRecentLp);
    }
  }, [charts?.moduleCompletion, selectedLpTitle]);

  const [completionGrowth, setCompletionGrowth] = useState(0);

  const isTrainerDrillDown = activeSection === 'TrainerTraineeDetail';
  const targetTraineeId = isTrainerDrillDown ? window.location.pathname.split('/').pop() : undefined;
  const scopedToTrainerId = isTrainerDrillDown ? currentUser.id : undefined;
  const isTrainee = activeRole.toLowerCase() === 'trainee' || isTrainerDrillDown;
  const isAdmin = useMemo(() => activeRole.toLowerCase() === 'admin' && !isTrainerDrillDown, [activeRole, isTrainerDrillDown]);
  const isTrainer = useMemo(() => activeRole.toLowerCase() === 'trainer' && !isTrainerDrillDown, [activeRole, isTrainerDrillDown]);

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
        const fetchRole = isTrainerDrillDown ? 'Trainee' : activeRole;
        const [analytics, usersList, pathsList, pendingSubs, mySubs, myProgress, pathSummary] = await Promise.all([
          (isTrainer
            ? analyticsService.fetchTrainerDashboardSummary(accessToken, currentUser.id)
            : analyticsService.fetchDashboard(accessToken, fetchRole, targetTraineeId, scopedToTrainerId)
          ).catch(() => null),
          userService.fetchAllUsers(accessToken).catch(() => []),
          learningPathService.fetchAllPaths(accessToken).catch(() => []),
          assignmentService.fetchPendingSubmissions(accessToken, activeRole).catch(() => []),
          isTrainee ? assignmentService.fetchMySubmissions(accessToken, activeRole).catch(() => []) : Promise.resolve([]),
          progressService.fetchMyStats(accessToken, targetTraineeId, scopedToTrainerId).catch(() => ({
            completedLessons: 0,
            totalLessons: 0,
            completionPercent: 0,
            averageScore: 0,
          })),
          progressService.fetchPathProgressSummary(accessToken).catch(() => ({})),
        ]);

        if (!isMounted) return;

        setAllPaths(pathsList || []);
        setPathProgressSummary(pathSummary || {});
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
        const calcRate = isTrainee ? (myProgress.completionPercent || 0) : (analytics?.completionRate || 0);

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
          averageScore: analytics?.averageScore !== undefined ? analytics.averageScore : 0,
          totalLessons: analytics?.totalLessons ?? myProgress.totalLessons ?? 0,
          currentStreak: analytics?.currentStreak ?? 0,
          activityTimestamps: (analytics as any)?.activityTimestamps || [],
          platformTotalTrainees: analytics?.platformTotalTrainees ?? 0,
          platformTotalTrainers: analytics?.platformTotalTrainers ?? 0,
          trainerLpsCreated: analytics?.trainerLpsCreated ?? 0,
          trainerAssignments: analytics?.trainerAssignments || { total: 0, internal: 0, external: 0 },
          trainerPendingReviews: pendingSubs?.length ?? 0,
          trainingEffectiveness: analytics?.trainingEffectiveness ?? 0,
          assignedTraineesProgress: analytics?.assignedTraineesProgress ?? [],
          tasksCompleted: analytics?.tasksCompleted ?? 0,
          learningVelocity: analytics?.learningVelocity ?? 0,
          activeEnrollments: analytics?.activeEnrollments ?? 0,
          totalMaxScore: analytics?.totalMaxScore ?? 0,
          totalGainedScore: analytics?.totalGainedScore ?? 0,
          skillGrowth: analytics?.skillGrowth ?? 0,
        });

        setPendingSubmissions(pendingSubs || analytics?.recentActivity || []);
        setMySubmissions(mySubs || []);
        if (analytics?.charts) {
          setCharts(analytics.charts);
        }

        if (isTrainee && pathsList?.length > 0) {
          let assigned = null;
          if (mySubs && mySubs.length > 0) {
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

          if (assigned) {
            try {
              const specificStats = await progressService.fetchMyStats(accessToken, targetTraineeId, scopedToTrainerId, assigned.id);
              if (specificStats) {
                setDbData(prev => ({ ...prev, completionRate: specificStats.completionPercent || 0 }));
              }
            } catch (e) {
              // ignore
            }
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
            <TraineeAssignmentsView accessToken={accessToken} currentUser={currentUser} activeRole={activeRole} />
          ) : (
            <TraineeSubmissionsView accessToken={accessToken} activeRole={activeRole} />
          )
        ) : (
          <TrainerEvaluationDashboard
            accessToken={accessToken}
            currentUser={currentUser}
            activeSection={activeSection}
            activeRole={activeRole}
          />
        )}
      </div>
    );
  }

  if (activeSection === 'Notifications') {
    return (
      <div className="dashboard-content">
        <NotificationsPage activeRole={activeRole} />
      </div>
    );
  }

  if (activeSection === 'Learning Paths') {
    return (
      <div className="dashboard-content">
        {selectedPathId ? (
          isTrainee ? (
            <ModulesManagementSection
              currentPathId={selectedPathId}
              currentPathTitle={selectedPathTitle || 'Curriculum Modules'}
              userRole="Trainee"
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
            highlightPathId={selectedPathId}
            currentUser={{
              id: currentUser?.id ?? 'trainee-99',
              name: currentUser?.firstName ?? 'User',
              role: activeRole as any,
            }}
            accessToken={accessToken}
            onNavigateToModules={(pathId: string, pathName: string) => {
              if (isTrainee) {
                navigate(`/learning-paths/${pathId}`, { state: { pathId, pathName } });
                setSelectedPathId(pathId);
                setSelectedPathTitle(pathName);
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
    const queryPathId = searchParams.get('pathId');
    const pathId = location.state?.pathId || queryPathId || urlPathId || selectedPathId || traineePath?.id || '';
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
          activeRole={isTrainerDrillDown ? 'Trainee' : activeRole}
          currentUser={currentUser}
          targetTraineeId={targetTraineeId}
          scopedToTrainerId={scopedToTrainerId}
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
  // SKELETON SCREEN IF DATA IS LOADING
  // ========================================================
  const firstName = currentUser.firstName || currentUser.name?.split(' ')[0] || 'User';

  if (isLoadingMetrics) {
    if (isTrainer) {
      return <TrainerDashboardSkeleton firstName={firstName} />;
    }
    return <DashboardSkeleton isTrainee={isTrainee} isAdmin={isAdmin} />;
  }

  // ========================================================
  // DEFAULT DASHBOARD HOME (ROLE-ADAPTIVE DB VIEWS)
  // ========================================================

  // 🟢 A. TRAINEE DASHBOARD VIEW
  if (isTrainee) {
    const currentPathTitle = traineePath?.title || traineePath?.name || 'No path assigned';
    const progressPercent = dbData.completionRate || 0;

    const combinedTimestamps = [
      ...(dbData.activityTimestamps || []),
      ...mySubmissions.map(s => s.submittedAt || s.createdAt),
    ];
    const { streak: currentStreak, activeToday } = calculateStreak(combinedTimestamps);

    const availableLps = Array.from(new Set([
      ...(charts?.pathPerformance || []).map((p: any) => p.title),
      ...(charts?.moduleCompletion || []).map((mc: any) => mc.pathTitle),
    ].filter(Boolean)));

    let filteredModuleCompletion = (charts?.moduleCompletion || []).filter(
      (mc: any) => !selectedLpTitle || mc.pathTitle === selectedLpTitle
    );

    if (filteredModuleCompletion.length === 0 && selectedLpTitle) {
      filteredModuleCompletion = [
        { id: 'dummy', title: 'No modules yet', percent: 0, pathTitle: selectedLpTitle, completed: 0, total: 0, averageScore: 0 },
      ];
    }

    const calculateLPProgress = (path: any, summaryMap: Record<string, any>): number => {
      if (!path) return 0;
      const summary = summaryMap[path.id];
      const totalModules = path.modules?.length ?? summary?.totalModules ?? 0;

      if (totalModules === 0) return 0;

      if (summary?.moduleProgresses && path.modules && Array.isArray(path.modules) && path.modules.length > 0) {
        const sum = path.modules.reduce((acc: number, mod: any) => {
          return acc + (summary.moduleProgresses?.[mod.id] ?? 0);
        }, 0);
        return Math.min(100, Math.round(sum / totalModules));
      }

      if (typeof summary?.userProgressPercent === 'number') {
        return summary.userProgressPercent;
      }

      if (path.modules && Array.isArray(path.modules) && path.modules.length > 0) {
        const sum = path.modules.reduce((acc: number, mod: any) => {
          return acc + Number(mod.progressPercent ?? mod.completionPercent ?? 0);
        }, 0);
        return Math.min(100, Math.round(sum / totalModules));
      }

      return path.progressPercent ?? 0;
    };

    // Build Radar Chart Data
    let skillData: Array<{ name: string; percent: number; count: number; pathId?: string }> = [];

    const assignedPaths = (allPaths || []).filter((p: any) => {
      if (isTrainerDrillDown && targetTraineeId) {
        return p.assignedToTraineeIds?.includes(targetTraineeId);
      }
      return p.assignedToTraineeIds?.includes(currentUser.id);
    });

    const activePaths = assignedPaths.length > 0
      ? assignedPaths
      : (allPaths || []).filter((p: any) => !['draft', 'archived', 'deleted'].includes(String(p.status || '').toLowerCase()));

    if (activePaths.length > 0) {
      skillData = activePaths.map((path: any) => {
        const progress = calculateLPProgress(path, pathProgressSummary);
        return {
          name: path.title || path.name || 'Untitled Path',
          percent: progress,
          count: path.modules?.length || 0,
          pathId: path.id,
        };
      });
    } else if (charts?.skillDistribution && charts.skillDistribution.length > 0) {
      skillData = charts.skillDistribution.map((item: any) => {
        const matchedPath = (allPaths || []).find((p: any) => p.id === item.pathId || p.title === item.name);
        const progress = matchedPath ? calculateLPProgress(matchedPath, pathProgressSummary) : (item.percent ?? 0);
        return {
          name: item.name,
          percent: progress,
          count: item.count || 0,
          pathId: item.pathId,
        };
      });
    }

    if (skillData.length === 0) {
      skillData = [{ name: 'No paths assigned', count: 0, percent: 0 }];
    }

    const realPathItems = skillData.filter(s => s.name && s.name.trim().length > 0 && s.name !== 'No paths assigned');

    // Keep radar geometry intact with at least 3 vertices
    const radarChartData = [...skillData];
    if (radarChartData.length > 0 && radarChartData.length < 3 && !radarChartData.some((s: any) => s.name === 'No paths assigned')) {
      while (radarChartData.length < 3) {
        radarChartData.push({ name: ' ', count: 0, percent: 0 });
      }
    }

    // Heatmap Range Stats
    const heatmapDaysLimit = heatmapRange * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const subsInRange = mySubmissions.filter((s: any) => {
      const d = new Date(s.submittedAt || s.createdAt).getTime();
      return !isNaN(d) && nowMs - d <= heatmapDaysLimit;
    });

    const activeDaysSet = new Set<string>();
    subsInRange.forEach((s: any) => {
      const d = new Date(s.submittedAt || s.createdAt);
      if (!isNaN(d.getTime())) {
        activeDaysSet.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
      }
    });

    const lessonProgressPct = Math.round((progressStats.completedLessons / Math.max(1, progressStats.totalLessons)) * 100);
    const tasksSubmittedPct = dbData.totalTasks > 0 ? Math.round(((dbData.tasksCompleted ?? 0) / dbData.totalTasks) * 100) : 0;

    return (
      <div className="db-container dashboard-content">
        {/* Executive Header */}
        <header className="db-header">
          <div className="db-header-left">
            {isTrainerDrillDown && (
              <button
                onClick={() => window.history.back()}
                className="db-btn-back"
                type="button"
              >
                <span>&larr;</span> Back to Cohort
              </button>
            )}
            <div className="db-header-title-wrap">
              <div className="db-header-title-row">
                <h1 className="db-header-title">
                  {isTrainerDrillDown ? 'Trainee Progress Inspection' : `Good morning, ${firstName}`}
                </h1>
                <span className="db-role-badge">
                  <span>{isTrainerDrillDown ? 'Inspection' : 'Trainee'}</span>
                </span>
              </div>
              <p className="db-header-subtitle">
                {progressPercent}% completed across {currentPathTitle}.
              </p>
            </div>
          </div>
        </header>

        {/* Hero Banner Card */}
        {!isTrainerDrillDown && (
          <TraineeHeroCard
            isLoading={false}
            hasProgress={(progressPercent > 0 || (dbData.activityTimestamps?.length ?? 0) > 0)}
            lastAccessedTitle={currentPathTitle}
            pathId={traineePath?.id}
            progressPercent={progressPercent}
          />
        )}

        {/* Symmetrical 6-Card Metrics Grid */}
        <section className="db-metrics-grid">
          {/* 1. Lesson Progress */}
          <MetricCard
            icon={<TrendingUp size={19} strokeWidth={1.75} />}
            iconBg="#f8fafc"
            iconColor="#4f46e5"
            value={`${lessonProgressPct}%`}
            label="Lesson Progress"
            hint={`${progressStats.completedLessons}/${progressStats.totalLessons} lessons`}
            hintType="positive"
            progressPercent={lessonProgressPct}
          />

          {/* 2. Current Streak */}
          <StreakCard
            currentStreak={currentStreak}
            activeToday={activeToday}
            onCelebrate={(val) => {
              analyticsService.celebrateStreak(val, accessToken).catch(console.error);
              setDbData(prev => ({ ...prev, currentStreak: val }));
            }}
          />

          {/* 3. Avg. Evaluation Score */}
          <MetricCard
            icon={<Award size={19} strokeWidth={1.75} />}
            iconBg="#f8fafc"
            iconColor="#475569"
            value={dbData.totalMaxScore === 0 ? '0/0' : `${fmt(dbData.totalGainedScore ?? 0)}/${fmt(dbData.totalMaxScore ?? 0)}`}
            label="Avg. Score"
            hint={dbData.totalMaxScore === 0 ? 'No graded work yet' : `Average: ${fmt(dbData.averageScore)}%`}
            hintType="neutral"
            trend={dbData.averageScore > 0 ? `${fmt(dbData.averageScore)}% avg` : undefined}
          />

          {/* 4. Tasks Completed */}
          <MetricCard
            icon={<CheckCircle2 size={19} strokeWidth={1.75} />}
            iconBg="#f8fafc"
            iconColor="#475569"
            value={dbData.totalTasks === 0 ? '0/0' : `${dbData.tasksCompleted ?? 0}/${dbData.totalTasks}`}
            label="Tasks Completed"
            hint={dbData.totalTasks === 0 ? 'No tasks assigned' : `${tasksSubmittedPct}% submitted`}
            hintType="positive"
            progressPercent={tasksSubmittedPct}
          />

          {/* 5. Learning Velocity */}
          <MetricCard
            icon={<Zap size={19} strokeWidth={1.75} />}
            iconBg="#f8fafc"
            iconColor="#475569"
            value={`${dbData.learningVelocity ?? 0} items/wk`}
            label="Learning Velocity"
            hint="Tasks, Lessons & Resources (7d)"
            hintType="neutral"
          />

          {/* 6. Active Learning Paths */}
          <MetricCard
            icon={<Compass size={19} strokeWidth={1.75} />}
            iconBg="#f8fafc"
            iconColor="#475569"
            value={String(dbData.activeEnrollments || 0)}
            label="Active Paths"
            hint={(dbData.activeEnrollments ?? 0) > 0 ? 'Enrolled curriculum paths' : 'No active paths'}
            hintType="positive"
          />
        </section>

        {/* Row 1: Daily Activity Trend & Skill Profile Radar */}
        <section className="db-layout-row-upper">
          {/* Left Column: Daily Activity Area Chart */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <DashboardCharts
              title="Daily Activity Trend"
              subtitle="Daily activity points (last 30 days)"
              role={isTrainerDrillDown ? 'trainee' : activeRole.toLowerCase()}
              type="score"
              accessToken={accessToken}
              targetTraineeId={targetTraineeId}
              scopedToTrainerId={scopedToTrainerId}
            />
          </div>

          {/* Right Column: Skill Profile Radar + Active Path Breakdown */}
          <div className="db-panel">
            <div className="db-panel-header">
              <div className="db-panel-title-group">
                <h3 className="db-panel-title">Skill Profile (Path Growth)</h3>
                <p className="db-panel-subtitle">Your progress & competency across paths</p>
              </div>
            </div>

            <div className="db-radar-container">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="68%"
                  data={radarChartData}
                  margin={{ top: 10, right: 25, bottom: 10, left: 25 }}
                >
                  <defs>
                    <linearGradient id="colorPerformance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" gridType="polygon" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={({ x, y, payload, textAnchor }: any) => {
                      if (!payload.value || payload.value === ' ') return <g />;
                      const label = String(payload.value);
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <title>{label}</title>
                          <text
                            x={0}
                            y={0}
                            dy={4}
                            textAnchor={textAnchor || 'middle'}
                            fill="#334155"
                            fontSize={11.5}
                            fontWeight={600}
                          >
                            {truncateLabel(label, 14)}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tickCount={5}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                  />
                  <Radar
                    name="Performance"
                    dataKey="percent"
                    stroke="#4f46e5"
                    fill="url(#colorPerformance)"
                    strokeWidth={2.4}
                    dot={{ r: 3.5, fill: '#fff', stroke: '#4f46e5', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                    animationDuration={1000}
                  />
                  <RechartsTooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        if (!item.name || item.name === ' ') return null;
                        return (
                          <div style={{ background: '#0f172a', padding: '9px 13px', borderRadius: '8px', color: '#fff', fontSize: '12px', boxShadow: '0 8px 18px rgba(0,0,0,0.2)' }}>
                            <strong style={{ display: 'block', marginBottom: '2px', color: '#f8fafc' }}>{item.name}</strong>
                            <span style={{ color: '#818cf8', fontWeight: 700, fontSize: '13px' }}>{Math.round(item.percent)}% Progress</span>
                            {item.count > 0 && (
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                {item.count} module{item.count !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Path Progress Breakdown List */}
            {realPathItems.length > 0 && (
              <div className="db-skill-paths-breakdown">
                {realPathItems.slice(0, 3).map((pathItem, idx) => (
                  <div key={idx} className="db-skill-path-item">
                    <div className="db-skill-path-left">
                      <span className="db-skill-path-name" title={pathItem.name}>
                        {pathItem.name}
                      </span>
                      <span className="db-skill-path-sub">
                        {pathItem.count} module{pathItem.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="db-skill-path-bar-wrap">
                      <div className="db-skill-path-bar-fill" style={{ width: `${Math.min(100, Math.round(pathItem.percent))}%` }} />
                    </div>
                    <span className="db-skill-path-pill">
                      {Math.round(pathItem.percent)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Row 2: Heatmap & Module Completion Bar Chart */}
        <section className="db-layout-row-lower">
          {/* Left Column: Heatmap */}
          <div className="db-panel">
            <div className="db-panel-header">
              <div className="db-panel-title-group">
                <h3 className="db-panel-title">Daily Activity Heatmap</h3>
                <p className="db-panel-subtitle">Submission volume & learning cadence</p>
              </div>
              <select
                className="db-select-control"
                value={heatmapRange}
                onChange={(e) => setHeatmapRange(Number(e.target.value))}
              >
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>

            {/* Heatmap Quick Stats Strip */}
            <div className="db-heatmap-stats-strip">
              <div className="db-heatmap-stat">
                <span className="db-heatmap-stat-label">Submissions</span>
                <span className="db-heatmap-stat-val">{subsInRange.length}</span>
              </div>
              <div className="db-heatmap-stat-divider" />
              <div className="db-heatmap-stat">
                <span className="db-heatmap-stat-label">Active Days</span>
                <span className="db-heatmap-stat-val">{activeDaysSet.size}</span>
              </div>
              <div className="db-heatmap-stat-divider" />
              <div className="db-heatmap-stat">
                <span className="db-heatmap-stat-label">Streak</span>
                <span className="db-heatmap-stat-val">{currentStreak}d</span>
              </div>
            </div>

            <div className="db-heatmap-scroll-area">
              <DailyActivityHeatmap submissions={mySubmissions} daysToDispay={heatmapRange} />
            </div>
          </div>

          {/* Right Column: Module Completion Bar Chart */}
          <div className="db-panel">
            <div className="db-panel-header">
              <div className="db-panel-title-group">
                <h3 className="db-panel-title">Module Completion Journey</h3>
                <p className="db-panel-subtitle">
                  {availableLps.length > 0 ? 'Breakdown by curriculum module' : 'No Paths'}
                </p>
              </div>
              {availableLps.length > 0 && (
                <select
                  className="db-select-control"
                  value={selectedLpTitle || ''}
                  onChange={(e) => setSelectedLpTitle(e.target.value)}
                >
                  {availableLps.map((lp: any) => (
                    <option key={lp} value={lp}>{lp}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="db-barchart-container">
              {filteredModuleCompletion.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredModuleCompletion} margin={{ top: 15, right: 20, left: -10, bottom: 55 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="title" axisLine={false} tickLine={false} interval={0} tick={<CustomXAxisTick />} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11.5, fill: '#64748b' }}
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <RechartsTooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
                      itemStyle={{ fontSize: '13px', fontWeight: 700, color: '#4f46e5' }}
                      labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}
                      formatter={(value: any) => [`${fmt(Number(value))}%`, 'Completion']}
                    />
                    <Bar dataKey="percent" name="Completion" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={55} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="db-empty-chart-state">
                  <BarChart2 size={32} opacity={0.4} />
                  <span>{(dbData.activeEnrollments ?? 0) === 0 ? 'No Learning Paths Assigned' : 'No module completion recorded.'}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  // 🟢 B. TRAINER DASHBOARD VIEW
  if (isTrainer) {
    const timeGreeting = getTimeGreeting();
    const trainerPendingReviews = (dbData as any).trainerPendingReviews ?? pendingSubmissions.length ?? 0;
    const totalTrainees = dbData.totalTrainees || 0;
    const lpsCreated = (dbData as any).trainerLpsCreated || 0;
    const assignmentsTotal = (dbData as any).trainerAssignments?.total || 0;
    const assignmentsInternal = (dbData as any).trainerAssignments?.internal || 0;
    const assignmentsExternal = (dbData as any).trainerAssignments?.external || 0;
    const effectiveness = (dbData as any).trainingEffectiveness;
    const avgScore = (dbData as any).averageScore;

    return (
      <div className="db-container dashboard-content">
        {/* Executive Trainer Header */}
        <header className="db-header">
          <div className="db-header-left">
            <div className="db-header-title-wrap">
              <div className="db-header-title-row">
                <h1 className="db-header-title">
                  {timeGreeting}, {firstName}
                </h1>
                <span className="db-role-badge db-role-badge-trainer">
                  <span>Trainer</span>
                </span>
              </div>
              <p className="db-header-subtitle">
                {trainerPendingReviews > 0
                  ? `You have ${trainerPendingReviews} submission${trainerPendingReviews > 1 ? 's' : ''} awaiting review across ${totalTrainees} assigned trainees.`
                  : `All reviews completed! ${totalTrainees} trainees are actively learning across your paths.`}
              </p>
            </div>
          </div>

          <div className="db-header-actions">
            <button
              className="db-btn-secondary"
              type="button"
              onClick={() => navigate('/assignments?status=pending')}
              title="Open pending submissions evaluation queue"
            >
              <ClipboardList size={16} />
              <span>Review Queue</span>
              {trainerPendingReviews > 0 && (
                <span className="db-header-badge-count">{trainerPendingReviews}</span>
              )}
            </button>
            <button
              className="db-btn-primary"
              type="button"
              onClick={() => navigate('/learning-paths/new')}
              title="Create a new learning path curriculum"
            >
              <Plus size={16} />
              <span>New Learning Path</span>
            </button>
          </div>
        </header>

        {/* 5-Card Balanced & Clickable Metrics Grid */}
        <section className="db-metrics-grid trainer-grid">
          {/* 1. Pending Reviews */}
          <MetricCard
            icon={<Clock size={19} strokeWidth={1.75} />}
            iconBg="#fff7ed"
            iconColor="#ea580c"
            value={trainerPendingReviews}
            label="Pending Reviews"
            hint={trainerPendingReviews > 0 ? "Awaiting your evaluation" : "Queue is fully cleared"}
            hintType={trainerPendingReviews > 0 ? 'warning' : 'positive'}
            trend={trainerPendingReviews > 0 ? 'Action Needed' : 'Clear'}
            onClick={() => navigate('/assignments?status=pending')}
            actionText="Review"
          />

          {/* 2. Active Trainees */}
          <MetricCard
            icon={<Users size={19} strokeWidth={1.75} />}
            iconBg="#f8fafc"
            iconColor="#475569"
            value={totalTrainees}
            label="Assigned Trainees"
            hint={(dbData as any).platformTotalTrainees ? `${(dbData as any).platformTotalTrainees} platform total` : "Across your cohorts"}
            hintType="neutral"
            onClick={() => navigate('/users')}
            actionText="View"
          />

          {/* 3. Learning Paths */}
          <MetricCard
            icon={<Compass size={19} strokeWidth={1.75} />}
            iconBg="#f8fafc"
            iconColor="#475569"
            value={lpsCreated}
            label="Learning Paths"
            hint={typeof (dbData as any).draftLpsCount === 'number' && (dbData as any).draftLpsCount > 0 ? `${(dbData as any).draftLpsCount} drafts pending` : "Curricula authored"}
            hintType={typeof (dbData as any).draftLpsCount === 'number' && (dbData as any).draftLpsCount > 0 ? 'warning' : 'neutral'}
            onClick={() => navigate('/learning-paths')}
            actionText="Manage"
          />

          {/* 4. Total Assignments */}
          <MetricCard
            icon={<Layers size={19} strokeWidth={1.75} />}
            iconBg="#f8fafc"
            iconColor="#475569"
            value={assignmentsTotal}
            label="Created Assignments"
            hint={`${assignmentsInternal} internal • ${assignmentsExternal} external`}
            hintType="neutral"
            onClick={() => navigate('/assignments')}
            actionText="Browse"
          />

          {/* 5. Cohort Effectiveness */}
          <MetricCard
            icon={<Award size={19} strokeWidth={1.75} />}
            iconBg="#f8fafc"
            iconColor="#059669"
            value={effectiveness === null || effectiveness === undefined ? '—' : `${effectiveness}%`}
            label="Cohort Effectiveness"
            hint={avgScore ? `Avg score: ${avgScore}%` : "Composite cohort health"}
            hintType="positive"
            progressPercent={typeof effectiveness === 'number' ? effectiveness : undefined}
            onClick={() => navigate('/analytics')}
            actionText="Analytics"
          />
        </section>

        {/* Assigned LPs & Trainee Progress Chart */}
        <section style={{ marginBottom: '24px' }}>
          <InteractiveTraineeProgress
            data={((dbData as any).assignedTraineesProgress || [])}
            isLoading={false}
            accessToken={accessToken}
          />
        </section>

        {/* Split Section: Real Recent Submissions Queue & Quick Workflow Actions */}
        <section className="db-layout-split">
          {/* Submissions Panel */}
          <div className="db-panel">
            <div className="db-panel-header">
              <div className="db-panel-title-group">
                <h3 className="db-panel-title">Evaluation Queue</h3>
                <span className="db-panel-subtitle">
                  {pendingSubmissions.length > 0
                    ? `${pendingSubmissions.length} submission${pendingSubmissions.length > 1 ? 's' : ''} awaiting review`
                    : 'Real-time assignment submissions from your trainees'}
                </span>
              </div>
              {pendingSubmissions.length > 0 && (
                <button
                  type="button"
                  className="db-btn-link"
                  onClick={() => navigate('/assignments?status=pending')}
                >
                  View All ({pendingSubmissions.length})
                </button>
              )}
            </div>

            {pendingSubmissions.length === 0 ? (
              <div className="db-queue-empty-state">
                <div className="db-queue-empty-icon">
                  <CheckCircle2 size={36} color="#10b981" />
                </div>
                <h4 className="db-queue-empty-title">All caught up!</h4>
                <p className="db-queue-empty-desc">
                  There are currently no submissions awaiting your review. Great job staying on top of trainee evaluations!
                </p>
                <button
                  type="button"
                  className="db-btn-link"
                  onClick={() => navigate('/assignments')}
                >
                  Browse All Assignments
                </button>
              </div>
            ) : (
              <div className="db-submissions-list">
                {pendingSubmissions.slice(0, 5).map((sub) => {
                  const traineeName = sub.trainee?.firstName
                    ? `${sub.trainee.firstName} ${sub.trainee.lastName || ''}`.trim()
                    : sub.trainee?.name || 'Trainee';
                  const taskTitle = sub.assignment?.title || 'Assignment Task';
                  const submittedTime = formatSubmissionTime(sub.submittedAt || sub.createdAt);
                  const isReviewed = sub.status === 'Reviewed' || sub.status === 'Approved';

                  return (
                    <div
                      key={sub.id}
                      className="db-submission-card"
                      onClick={() => navigate(`/assignments?id=${sub.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/assignments?id=${sub.id}`);
                        }
                      }}
                      title={`Click to evaluate submission from ${traineeName}`}
                    >
                      <div className="db-submission-left">
                        <div
                          className="db-submission-avatar"
                          style={{
                            backgroundColor: getAvatarBg(traineeName),
                            color: getAvatarColor(traineeName),
                          }}
                        >
                          {getInitials(traineeName)}
                        </div>
                        <div className="db-submission-info">
                          <div className="db-submission-name-row">
                            <span className="db-submission-name">{traineeName}</span>
                            <span className="db-submission-time">{submittedTime}</span>
                          </div>
                          <div className="db-submission-task">{taskTitle}</div>
                        </div>
                      </div>

                      <div className="db-submission-right">
                        <span className={`db-status-badge ${isReviewed ? 'reviewed' : 'pending'}`}>
                          {sub.status || 'Pending Review'}
                        </span>
                        <span className="db-submission-cta">
                          <span>Review</span>
                          <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          <div className="db-panel">
            <div className="db-panel-header">
              <div className="db-panel-title-group">
                <h3 className="db-panel-title">Workflow Shortcuts</h3>
                <span className="db-panel-subtitle">Frequently used instructor tools</span>
              </div>
            </div>

            <div className="db-shortcuts-list">
              <div
                className="db-shortcut-item"
                onClick={() => navigate('/assignments?status=pending')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/assignments?status=pending');
                  }
                }}
              >
                <div className="db-shortcut-icon-box" style={{ background: '#fff7ed', color: '#ea580c' }}>
                  <ClipboardList size={18} />
                </div>
                <div className="db-shortcut-content">
                  <span className="db-shortcut-label">Evaluate Submissions</span>
                  <span className="db-shortcut-desc">
                    {trainerPendingReviews > 0 ? `${trainerPendingReviews} waiting in queue` : 'Queue is clear'}
                  </span>
                </div>
                <button type="button" className="db-btn-link" onClick={(e) => { e.stopPropagation(); navigate('/assignments?status=pending'); }}>
                  Review Now
                </button>
              </div>

              <div
                className="db-shortcut-item"
                onClick={() => navigate('/learning-paths/new')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/learning-paths/new');
                  }
                }}
              >
                <div className="db-shortcut-icon-box" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                  <Plus size={18} />
                </div>
                <div className="db-shortcut-content">
                  <span className="db-shortcut-label">New Learning Path</span>
                  <span className="db-shortcut-desc">Author a new curriculum path</span>
                </div>
                <button type="button" className="db-btn-link" onClick={(e) => { e.stopPropagation(); navigate('/learning-paths/new'); }}>
                  Create Path
                </button>
              </div>

              <div
                className="db-shortcut-item"
                onClick={() => navigate('/learning-paths')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/learning-paths');
                  }
                }}
              >
                <div className="db-shortcut-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <BookOpen size={18} />
                </div>
                <div className="db-shortcut-content">
                  <span className="db-shortcut-label">Manage Curricula</span>
                  <span className="db-shortcut-desc">
                    {typeof (dbData as any).draftLpsCount === 'number' && (dbData as any).draftLpsCount > 0
                      ? `${(dbData as any).draftLpsCount} drafts pending`
                      : 'Edit learning paths & modules'}
                  </span>
                </div>
                <button type="button" className="db-btn-link" onClick={(e) => { e.stopPropagation(); navigate('/learning-paths'); }}>
                  Manage
                </button>
              </div>

              <div
                className="db-shortcut-item"
                onClick={() => navigate('/users')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/users');
                  }
                }}
              >
                <div className="db-shortcut-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
                  <Users size={18} />
                </div>
                <div className="db-shortcut-content">
                  <span className="db-shortcut-label">Cohort Directory</span>
                  <span className="db-shortcut-desc">Inspect trainee enrollments</span>
                </div>
                <button type="button" className="db-btn-link" onClick={(e) => { e.stopPropagation(); navigate('/users'); }}>
                  View Users
                </button>
              </div>

              <div
                className="db-shortcut-item"
                onClick={() => navigate('/analytics')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/analytics');
                  }
                }}
              >
                <div className="db-shortcut-icon-box" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                  <BarChart2 size={18} />
                </div>
                <div className="db-shortcut-content">
                  <span className="db-shortcut-label">Cohort Analytics</span>
                  <span className="db-shortcut-desc">Progress velocity & scores</span>
                </div>
                <button type="button" className="db-btn-link" onClick={(e) => { e.stopPropagation(); navigate('/analytics'); }}>
                  Analytics
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // 🔵 C. ADMIN DASHBOARD VIEW
  return (
    <div className="db-container dashboard-content">
      <header className="db-header">
        <div className="db-header-left">
          <div className="db-header-title-wrap">
            <div className="db-header-title-row">
              <h1 className="db-header-title">Good morning, {firstName}</h1>
              <span className="db-role-badge">
                <span>Administrator</span>
              </span>
            </div>
            <p className="db-header-subtitle">
              System overview: Active learning paths, user roles, and review pipelines.
            </p>
          </div>
        </div>

        <div className="db-header-actions">
          <button
            className="db-btn-primary"
            type="button"
            onClick={() => setShowInviteModal(true)}
          >
            <Plus size={16} />
            <span>Add User</span>
          </button>
        </div>
      </header>

      {/* Admin Metric Cards */}
      <section className="db-metrics-grid admin-grid">
        <MetricCard
          icon={<Users size={19} strokeWidth={1.75} />}
          iconBg="#f8fafc"
          iconColor="#475569"
          value={dbData.totalTrainees}
          label="Total Trainees"
          hint={`${dbData.totalTrainers} trainers active`}
          hintType="positive"
        />

        <MetricCard
          icon={<ClipboardList size={19} strokeWidth={1.75} />}
          iconBg="#f8fafc"
          iconColor="#475569"
          value={dbData.totalTasks}
          label="Active Assignments"
          hint={`${dbData.totalModules} modules live`}
          hintType="neutral"
        />

        <MetricCard
          icon={<Clock size={19} strokeWidth={1.75} />}
          iconBg="#fff7ed"
          iconColor="#ea580c"
          value={dbData.pendingReviews}
          label="Pending Reviews"
          hint="Needs trainer review"
          hintType={dbData.pendingReviews > 0 ? 'warning' : 'positive'}
        />

        <MetricCard
          icon={<TrendingUp size={19} strokeWidth={1.75} />}
          iconBg="#f8fafc"
          iconColor="#059669"
          value={`${dbData.completionRate}%`}
          label="Completion Rate"
          hint={`${completionGrowth >= 0 ? '+' : ''}${completionGrowth}% vs last month`}
          hintType={completionGrowth >= 0 ? 'positive' : 'negative'}
          progressPercent={dbData.completionRate}
        />
      </section>

      {/* Admin Charts Row */}
      <section className="db-layout-split">
        <DashboardCharts
          title="Progress Trends"
          subtitle="Submissions vs Completions across cohorts"
          role={activeRole.toLowerCase()}
          type="progress"
          accessToken={accessToken}
        />
        <DashboardCharts
          title="Avg. Evaluation Score"
          subtitle="Weekly average score trends"
          role={activeRole.toLowerCase()}
          type="score"
          accessToken={accessToken}
        />
      </section>

      {/* Admin: Trainee Progress Overview */}
      <section style={{ marginBottom: '24px' }}>
        <InteractiveTraineeProgress
          data={((dbData as any).assignedTraineesProgress || [])}
          isLoading={false}
          accessToken={accessToken}
        />
      </section>

      {/* Admin: Quick Actions & Recent Submissions */}
      <section className="db-layout-split">
        <div className="db-panel">
          <div className="db-panel-header">
            <h3 className="db-panel-title">Recent Submissions</h3>
          </div>
          {pendingSubmissions.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>No pending submissions in database queue.</div>
          ) : (
            <div>
              {pendingSubmissions.slice(0, 5).map((sub) => (
                <div key={sub.id} className="db-submission-item">
                  <div>
                    <div className="db-submission-name">{sub.trainee?.firstName || sub.trainee?.name || 'Trainee'}</div>
                    <div className="db-submission-task">{sub.assignment?.title || 'Assignment Task'}</div>
                  </div>
                  <span className={`db-status-badge ${sub.status === 'Reviewed' ? 'reviewed' : 'pending'}`}>
                    {sub.status || 'Pending Review'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="db-panel">
          <div className="db-panel-header">
            <h3 className="db-panel-title">Quick Actions</h3>
          </div>
          <div>
            <div className="db-quick-action-item">
              <span className="db-quick-action-label">Evaluate pending submissions</span>
              <button type="button" className="db-btn-link" onClick={() => navigate('/assignments?status=pending')}>
                Review Now
              </button>
            </div>
            <div className="db-quick-action-item">
              <span className="db-quick-action-label">Manage cohort progress</span>
              <button type="button" className="db-btn-link" onClick={() => navigate('/users')}>
                View Users
              </button>
            </div>
            <div className="db-quick-action-item">
              <span className="db-quick-action-label">
                Update curriculum content
                {typeof (dbData as any).draftLpsCount === 'number' && (dbData as any).draftLpsCount > 0 && (
                  <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#fef3c7', color: '#d97706', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                    {(dbData as any).draftLpsCount} Drafts
                  </span>
                )}
              </span>
              <button type="button" className="db-btn-link" onClick={() => navigate('/learning-paths')}>
                Edit Paths
              </button>
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
