import { useEffect, useState } from 'react';
import type { SessionUser, RoleName } from '../../types/auth';
import { analyticsService, progressService, type ChartBundle } from '../../services/lmsApi';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { DashboardCharts } from '../DashboardCharts/DashboardCharts';
import { MultiLineProgressChart, type SeriesConfig } from '../MultiLineProgressChart/MultiLineProgressChart';

const truncateLabel = (name: string, maxLen = 14) => {
  if (!name) return '';
  return name.length > maxLen ? name.slice(0, maxLen).trim() + "…" : name;
};

const CustomXAxisTick = ({ x, y, payload }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        fill="#64748b"
        fontSize={12}
        transform="rotate(-25)"
      >
        {truncateLabel(payload.value, 15)}
      </text>
    </g>
  );
};

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
  const [showTraineeModal, setShowTraineeModal] = useState(false);
  const [selectedLpTitle, setSelectedLpTitle] = useState<string | null>(null);

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
          analyticsService.fetchDashboard(accessToken, activeRole).catch(() => null),
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

  useEffect(() => {
    if (charts.moduleCompletion.length > 0 && !selectedLpTitle) {
      const lps = Array.from(new Set(charts.moduleCompletion.map((mc: any) => mc.pathTitle).filter(Boolean)));
      const inProgress = charts.moduleCompletion.find((mc: any) => mc.percent > 0 && mc.percent < 100)?.pathTitle;
      setSelectedLpTitle(inProgress || (lps[0] as string));
    }
  }, [charts.moduleCompletion, selectedLpTitle]);

  const availableLps = Array.from(new Set([
    ...charts.pathPerformance.map((p: any) => p.title),
    ...charts.moduleCompletion.map((mc: any) => mc.pathTitle)
  ].filter(Boolean)));
  
  let filteredModuleCompletion = charts.moduleCompletion.filter((mc: any) => !selectedLpTitle || mc.pathTitle === selectedLpTitle);
  
  if (filteredModuleCompletion.length === 0 && selectedLpTitle) {
    filteredModuleCompletion = [{ title: 'No modules yet', percent: 0, pathTitle: selectedLpTitle }];
  }

  const velocity = `${stats.learningVelocity} items/wk`;

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  const skillData = charts.skillDistribution.length
    ? charts.skillDistribution
    : [{ name: 'No data', count: 0, percent: 100 }];

  const traineeProgressList = charts.traineeProgressList || [];

  const pathData = charts.pathPerformance.slice(0, 8).map((row: any) => ({
    name: row.title || 'Unknown Path',
    percent: row.averageProgress !== undefined ? row.averageProgress : (row.submitted > 0 ? Math.round((row.completed / row.submitted) * 100) : 0),
    enrolled: row.enrolledTrainees !== undefined ? row.enrolledTrainees : row.submitted,
    score: row.averageScore || 0,
    ...row
  }));

  const traineeSeriesKeys = new Set<string>();
  pathData.forEach((row: any) => {
    Object.keys(row).forEach(key => {
      if (!['id', 'title', 'submitted', 'completed', 'averageScore', 'name', 'percent', 'enrolled', 'score', 'averageProgress', 'enrolledTrainees'].includes(key)) {
        traineeSeriesKeys.add(key);
      }
    });
  });

  const traineePathSeries: SeriesConfig[] = Array.from(traineeSeriesKeys).map((key: string, idx: number) => ({
    key: key,
    name: key,
    color: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][idx % 5],
    type: 'bar'
  }));

  const cohortPathSeries: SeriesConfig[] = [
    { key: 'percent', name: 'Average Progress', color: '#4f46e5', type: 'bar' },
    { key: 'score', name: 'Average Score', color: '#10b981', type: 'bar' }
  ];

  const pathProgressionData = charts.pathProgression || [];

  const progressionSeriesKeys = new Set<string>();
  pathProgressionData.forEach((row: any) => {
    Object.keys(row).forEach(key => {
      if (key !== 'sequence' && !key.endsWith('_name')) {
        progressionSeriesKeys.add(key);
      }
    });
  });
  const distinctPaths = Array.from(progressionSeriesKeys);

  const detailedModuleSeries: SeriesConfig[] = distinctPaths.map((p: string, idx: number) => ({
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
          hint={isReports ? "Assigned on platform" : `Across all assigned paths`}
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
              value={loading ? '...' : String(stats.activeEnrollments || 0)}
              label="Total Paths Assigned"
              hint={stats.activeEnrollments > 0 ? "Active Learning Paths" : "No active paths"}
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
          accessToken={accessToken}
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
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}>
            <button
              onClick={() => setShowTraineeModal(true)}
              style={{ padding: '6px 12px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              See Trainee Progress
            </button>
          </div>
          <MultiLineProgressChart
            title="Path Performance"
            subtitle="Aggregate Averages"
            xAxisKey="name"
            series={cohortPathSeries}
            data={pathData}
            emptyMessage="No path progress in database."
          />
        </div>
      )}

      {showTraineeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Trainee Progress Overview</h2>
              <button onClick={() => setShowTraineeModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', color: '#334155' }}>Trainee Statistics</h3>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Trainee Name</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Completed Tasks</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Remaining Tasks</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Overall Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traineeProgressList.map((t: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 500, color: '#0f172a' }}>{t.name}</td>
                          <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 600 }}>{t.completed}</td>
                          <td style={{ padding: '12px 16px', color: '#f59e0b', fontWeight: 600 }}>{t.remaining}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', background: '#4f46e5', width: `${t.progress}%` }} />
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', width: '35px' }}>{t.progress}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {traineeProgressList.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No trainee data available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: '32px' }}>
                <MultiLineProgressChart
                  title="Graphical Trainee Progress"
                  subtitle="Path Performance by Trainee"
                  xAxisKey="name"
                  series={traineePathSeries}
                  data={pathData}
                  emptyMessage="No path progress in database."
                />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right' }}>
              <button onClick={() => setShowTraineeModal(false)} style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {!isReports && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>Trainee Learning Journey - Module Completion</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                {availableLps.length > 0 ? 'Select a Learning Path to view modules' : 'No Paths'}
              </p>
            </div>
            {availableLps.length > 0 && (
              <select
                value={selectedLpTitle || ''}
                onChange={(e) => setSelectedLpTitle(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#f8fafc',
                  cursor: 'pointer'
                }}
              >
                {availableLps.map((lp: any) => (
                  <option key={lp} value={lp}>{lp}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ width: '100%', height: 450 }}>
            {filteredModuleCompletion.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={filteredModuleCompletion} margin={{ top: 20, right: 30, left: 0, bottom: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="title" axisLine={false} tickLine={false} interval={0} tick={<CustomXAxisTick />} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(val) => `${val}%`} />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: '13px', fontWeight: 600, color: '#4f46e5' }}
                    labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}
                    formatter={(value: any) => [`${value}%`, 'Completion Percentage']}
                  />
                  <Bar dataKey="percent" name="Completion Percentage (%)" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
                No module progress in database.
              </div>
            )}
          </div>
        </div>
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


