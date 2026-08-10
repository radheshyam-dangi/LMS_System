import { useEffect, useState } from 'react';
import type { SessionUser, RoleName } from '../../types/auth';
import { analyticsService, progressService, type ChartBundle } from '../../services/lmsApi';
import { seriesToPolyline, donutSlices } from '../../utils/charts';

type ProgressAnalyticsProps = {
  currentUser: SessionUser;
  activeRole: RoleName;
  accessToken: string;
};

export function ProgressAnalyticsSection({ currentUser, activeRole, accessToken }: ProgressAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    averageScore: 0,
    completedLessons: 0,
    totalLessons: 0,
    completionPercent: 0,
    totalAssignments: 0,
    pendingReviews: 0,
    completionRate: 0,
    completionGrowth: 0,
    activeEnrollments: 0,
  });
  const [charts, setCharts] = useState<ChartBundle>({
    progressTrends: [],
    weeklyScores: [],
    skillDistribution: [],
    moduleCompletion: [],
    pathPerformance: [],
  });

  const displayName =
    [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') ||
    currentUser.name ||
    'Learner';
  const isReports = activeRole === 'Admin' || activeRole === 'Trainer';

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [analytics, progress] = await Promise.all([
          analyticsService.fetchDashboard(accessToken).catch(() => null),
          progressService.fetchMyStats(accessToken).catch(() => ({
            completedLessons: 0,
            totalLessons: 0,
            completionPercent: 0,
          })),
        ]);
        if (!mounted) return;
        setStats({
          averageScore: analytics?.averageScore ?? 0,
          completedLessons: progress.completedLessons,
          totalLessons: progress.totalLessons,
          completionPercent: progress.completionPercent,
          totalAssignments: analytics?.totalAssignments ?? 0,
          pendingReviews: analytics?.pendingReviews ?? 0,
          completionRate: analytics?.completionRate ?? 0,
          completionGrowth: analytics?.completionGrowth ?? 0,
          activeEnrollments: analytics?.activeEnrollments ?? 0,
        });
        if (analytics?.charts) setCharts(analytics.charts);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const velocity =
    stats.totalLessons > 0
      ? (stats.completedLessons / Math.max(1, stats.totalLessons / 8)).toFixed(1)
      : '0.0';

  const scoreSeries = charts.weeklyScores.map((w) => w.averageScore);
  const trendLine = seriesToPolyline(
    scoreSeries.some((v) => v > 0) ? scoreSeries : [0, 0, 0, 0, 0, 0, 0, 0],
    500,
    180,
    40,
    20,
  );
  const slices = donutSlices(
    charts.skillDistribution.length
      ? charts.skillDistribution
      : [{ name: 'No data', count: 0, percent: 0 }],
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1320px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          {isReports ? 'Reports Dashboard' : 'Progress Analytics'}
        </h1>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
          {displayName} — live metrics from database
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard
          value={loading ? '...' : isReports ? `${stats.completionRate}%` : `${stats.averageScore}/100`}
          label={isReports ? 'Training Effectiveness' : 'Avg. Score'}
          hint={`${stats.completionGrowth >= 0 ? '+' : ''}${stats.completionGrowth}% growth`}
        />
        <MetricCard
          value={loading ? '...' : isReports ? `${stats.completionRate}%` : `${stats.completedLessons}/${stats.totalLessons}`}
          label={isReports ? 'Avg. Completion Rate' : 'Tasks Completed'}
          hint={isReports ? 'From submissions' : `${stats.completionPercent}% overall`}
        />
        <MetricCard
          value={loading ? '...' : isReports ? `${stats.averageScore}/100` : `${velocity} tasks/wk`}
          label={isReports ? 'Average Score' : 'Learning Velocity'}
          hint="From evaluations"
        />
        <MetricCard
          value={loading ? '...' : isReports ? String(stats.activeEnrollments) : `${stats.completionPercent}%`}
          label={isReports ? 'Active Learners' : 'Skill Growth'}
          hint={`${stats.totalAssignments} assignments`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isReports ? '2fr 1fr' : '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0' }}>
            {isReports ? 'Training Effectiveness' : 'Performance Trend'}
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px 0' }}>
            {isReports ? 'Completion rate by month' : 'Evaluation scores over weeks'}
          </p>
          <div style={{ height: '180px', position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="100" x2="480" y2="100" stroke="#f1f5f9" strokeDasharray="3 3" />
              <path d={`${trendLine.path} L 460,160 L 40,160 Z`} fill="url(#trendFill)" />
              <path d={trendLine.path} fill="none" stroke="#4f46e5" strokeWidth="2.5" />
              {trendLine.coords.map((c, i) => (
                <g key={i}>
                  <circle cx={c.x} cy={c.y} r="5" fill="#4f46e5" style={{ cursor: 'pointer' }}>
                    <title>{`${charts.weeklyScores[i]?.label || `W${i + 1}`} — Score: ${scoreSeries[i] ?? 0}`}</title>
                  </circle>
                </g>
              ))}
            </svg>
            {!scoreSeries.some((v) => v > 0) && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                0% · no chart data yet
              </div>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0' }}>
            {isReports ? 'Skill Distribution' : 'Skill Profile'}
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px 0' }}>Learners by track</p>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <svg width="120" height="120" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="28" fill="#fff" />
              {slices.map((s) => (
                <path key={s.name} d={s.d} fill="none" stroke={s.color} strokeWidth="14">
                  <title>{`${s.name}: ${s.count ?? 0} (${s.percent || 0}%)`}</title>
                </path>
              ))}
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              {slices.map((s) => (
                <div key={s.name} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  <span style={{ color: '#475569' }}>{s.name}</span>
                  <strong style={{ marginLeft: 'auto' }}>{s.percent || 0}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0' }}>
          {isReports ? 'Path Performance' : 'Module Completion'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(isReports ? charts.pathPerformance : charts.moduleCompletion).length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>No module/path progress in database (0%).</div>
          )}
          {(isReports ? charts.pathPerformance : charts.moduleCompletion).slice(0, 8).map((row: any) => {
            const percent = isReports
              ? row.submitted > 0
                ? Math.round((row.completed / row.submitted) * 100)
                : 0
              : row.percent;
            return (
              <div key={row.id || row.title} title={isReports ? `${row.title}: Enrolled/Submitted ${row.submitted}, Completed ${row.completed}, Avg ${row.averageScore}` : `${row.title}: ${percent}% · ${row.averageScore || 0}/100`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{row.title}</span>
                  <span style={{ color: '#64748b' }}>
                    {percent}% · {isReports ? `${row.averageScore}/100` : `${row.averageScore || 0}/100`}
                  </span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${percent}%`, height: '100%', background: percent >= 100 ? '#10b981' : '#4f46e5' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, marginTop: '4px' }}>{hint}</div>
    </div>
  );
}
