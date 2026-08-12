import { useEffect, useState } from 'react';
import type { SessionUser, RoleName } from '../../types/auth';
import { analyticsService, progressService, type ChartBundle } from '../../services/lmsApi';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { DashboardCharts } from '../DashboardCharts/DashboardCharts';
import { MultiLineProgressChart, type SeriesConfig } from '../MultiLineProgressChart/MultiLineProgressChart';

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
    skillGrowth: 0,
    tasksCompleted: 0,
    totalGainedScore: 0,
    totalMaxScore: 0,
    learningVelocity: 0,
    consistencyScore: 0,
    currentStreak: 0,
    learningStyle: 'Unknown',
    estimatedCompletionDate: '',
    totalTrainers: 0,
    totalTrainees: 0,
    trainingEffectiveness: 0,
  });
  const [charts, setCharts] = useState<ChartBundle>({
    progressTrends: [],
    weeklyScores: [],
    dailyScores: [],
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
          skillGrowth: analytics?.skillGrowth ?? 0,
          tasksCompleted: analytics?.tasksCompleted ?? 0,
          totalGainedScore: analytics?.totalGainedScore ?? 0,
          totalMaxScore: analytics?.totalMaxScore ?? 0,
          learningVelocity: analytics?.learningVelocity ?? 0,
          consistencyScore: analytics?.consistencyScore ?? 0,
          currentStreak: analytics?.currentStreak ?? 0,
          learningStyle: analytics?.learningStyle ?? 'Unknown',
          estimatedCompletionDate: analytics?.estimatedCompletionDate ?? '',
          totalTrainers: analytics?.totalTrainers ?? 0,
          totalTrainees: analytics?.totalTrainees ?? 0,
          trainingEffectiveness: analytics?.trainingEffectiveness ?? 0,
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

  const velocity = `${stats.learningVelocity} items/wk`;

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  const skillData = charts.skillDistribution.length
    ? charts.skillDistribution
    : [{ name: 'No data', count: 0, percent: 100 }];

  let pathData = charts.pathPerformance.slice(0, 8).map((row: any) => ({
    name: row.title || 'Unknown Path',
    percent: row.averageProgress !== undefined ? row.averageProgress : (row.submitted > 0 ? Math.round((row.completed / row.submitted) * 100) : 0),
    enrolled: row.enrolledTrainees !== undefined ? row.enrolledTrainees : row.submitted,
    score: row.averageScore || 0
  }));

  if (pathData.length > 0) {
    pathData = [{ name: 'Start', percent: 0, score: 0, enrolled: 0 }, ...pathData];
  }

  const moduleData = charts.moduleCompletion.map((row: any) => ({
    name: row.title || 'Unknown Module',
    percent: row.percent || 0,
    score: row.averageScore || 0,
    maxScore: row.maxScore || 0,
    path: row.pathTitle
  }));

  const distinctPaths = Array.from(new Set(moduleData.map((d: any) => d.path).filter(Boolean)));
  const allModuleNames = Array.from(new Set(moduleData.map((d: any) => d.name)));

  let detailedModuleChartData = allModuleNames.map((moduleName: any) => {
    const row: any = { sequence: moduleName };
    distinctPaths.forEach((path: any) => {
      const mod = moduleData.find((d: any) => d.path === path && d.name === moduleName);
      if (mod) {
        row[path] = mod.percent;
        row[`${path}_name`] = mod.name;
      }
    });
    return row;
  });

  if (detailedModuleChartData.length > 0) {
    const startRow: any = { sequence: 'Start' };
    distinctPaths.forEach((path: any) => {
      startRow[path] = 0;
      startRow[`${path}_name`] = 'Start';
    });
    detailedModuleChartData = [startRow, ...detailedModuleChartData];
  }
  const detailedModuleSeries: SeriesConfig[] = distinctPaths.map((p: any, idx: number) => ({
    key: p,
    name: p,
    color: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][idx % 5],
  }));

  return (
    <div style={{ padding: '24px 32px', width: '100%', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          {isReports ? 'Reports Dashboard' : ''}
        </h1>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
          {displayName} — live metrics from database
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard
          value={loading ? '...' : isReports ? `${stats.trainingEffectiveness}/100` : `${stats.averageScore}%`}
          label={isReports ? 'Training Effectiveness (Health)' : 'Avg. Score'}
          hint={isReports ? `Composite (Score & Completion)` : `${stats.totalGainedScore} / ${stats.totalMaxScore} pts`}
        />
        <MetricCard
          value={loading ? '...' : isReports ? `${stats.completionRate}%` : `${stats.completionRate}%`}
          label={isReports ? 'Avg. Completion Rate' : 'Tasks Completed'}
          hint={isReports ? "From submissions" : `${stats.tasksCompleted} / ${stats.totalAssignments} submitted`}
        />
        <MetricCard
          value={loading ? '...' : isReports ? `${stats.averageScore}/100` : velocity}
          label={isReports ? 'Average Score' : 'Learning Velocity'}
          hint={isReports ? "From evaluations" : "Tasks & Lessons (7d)"}
        />
        <MetricCard
          value={loading ? '...' : isReports ? String(stats.totalTrainees || 0) : `${stats.skillGrowth}%`}
          label={isReports ? 'Total Trainees' : 'Skill Growth'}
          hint={isReports ? "Assigned on platform" : `${stats.totalAssignments} assignments`}
        />
        {isReports && (
          <MetricCard
            value={loading ? '...' : String(stats.totalTrainers || 0)}
            label="Total Trainers"
            hint="Active on platform"
          />
        )}
        {!isReports && (
          <>
            <MetricCard
              value={loading ? '...' : `${stats.consistencyScore}%`}
              label="Consistency Score"
              hint={`${stats.currentStreak} day streak`}
            />
            <MetricCard
              value={loading ? '...' : stats.learningStyle}
              label="Learning Style"
              hint={stats.estimatedCompletionDate !== 'N/A' && stats.estimatedCompletionDate !== 'Completed' ? `Goal: ${stats.estimatedCompletionDate}` : stats.estimatedCompletionDate}
            />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isReports ? '2fr 1fr' : '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <DashboardCharts
          title={isReports ? 'Avg. Evaluation Score Trend' : 'Daily Activity Trend'}
          subtitle={isReports ? 'Daily evaluation scores (last 14 days)' : 'Daily activity points (last 30 days)'}
          role={activeRole.toLowerCase()}
          type="score" 
          datasets={{
            daily: (charts.dailyScores || []).map((d: any) => ({ ...d, name: d.label, averageScore: d.averageScore || d.activityPoints })),
            weekly: (charts.weeklyScores || []).map((d: any) => ({ ...d, name: d.label, averageScore: d.averageScore || d.activityPoints })),
            monthly: (charts.monthlyScores || []).map((d: any) => ({ ...d, name: d.label, averageScore: d.averageScore || d.activityPoints }))
          }}
        />

        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
            {isReports ? 'Skill Distribution' : 'Skill Profile (Path Growth)'}
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px 0' }}>
            {isReports ? 'Learners by track' : 'Your performance across paths'}
          </p>
          <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
            {isReports ? (
              <>
                <div style={{ width: '120px', height: '120px', flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={skillData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={2}
                        dataKey="percent"
                        stroke="none"
                      >
                        {skillData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: any, name: any, props: any) => [
                          `${props.payload.count || 0} learners (${value}%)`,
                          name
                        ]}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', width: '100%', maxHeight: '140px', overflowY: 'auto' }}>
                  {skillData.map((s, idx) => (
                    <div key={s.name} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[idx % COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.name}>{s.name}</span>
                      <strong style={{ marginLeft: 'auto' }}>{s.percent || 0}%</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', minHeight: '160px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Radar name="Performance" dataKey="percent" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.2} />
                    <RechartsTooltip 
                      formatter={(value: any) => [`${value}%`, 'Performance']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {isReports && (
        <MultiLineProgressChart
          title="Path Performance"
          subtitle="Aggregate Averages"
          xAxisKey="name"
          series={[
            { key: 'percent', name: 'Average Progress', color: '#4f46e5' },
            { key: 'score', name: 'Average Score', color: '#10b981' }
          ]}
          data={pathData}
          emptyMessage="No path progress in database."
        />
      )}

      {!isReports && (
        <MultiLineProgressChart
          title="Module Progress"
          subtitle={distinctPaths.length > 0 ? distinctPaths.join(', ') : 'All Paths'}
          xAxisKey="sequence"
          series={detailedModuleSeries}
          data={detailedModuleChartData}
          emptyMessage="No module progress in database."
          tooltipLabelFormatter={(label: any) => label}
          tooltipFormatter={(value: any, name: string, props: any) => {
            const pathName = props.dataKey;
            const moduleName = props.payload[`${pathName}_name`];
            return [
              `${value}%`, 
              moduleName && moduleName !== 'Start' ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{pathName}</span>
                  <span style={{ color: '#64748b', fontSize: '11px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {moduleName}
                  </span>
                </div>
              ) : pathName
            ];
          }}
        />
      )}
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


