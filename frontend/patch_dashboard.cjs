const fs = require('fs');

let content = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');
const components = fs.readFileSync('../streak_components.tsx', 'utf8');

// 1. Add imports
content = content.replace(
  'import { analyticsService, progressService, type ChartBundle } from \'../services/lmsApi\';',
  'import { analyticsService, progressService, type ChartBundle } from \'../services/lmsApi\';\nimport confetti from \'canvas-confetti\';\nimport { DashboardCharts } from \'../components/DashboardCharts/DashboardCharts\';'
);

// 2. Inject components
content = content.replace(
  'export function DashboardPage(',
  components + '\n\nexport function DashboardPage('
);

// 3. Replace Trainee SVG Ring
const ringCode = `<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
  <div style={{ position: 'relative', width: '130px', height: '130px', cursor: 'pointer' }}>
    <TraineeProgressRing
      progressPercent={progressPercent}
      completedLessons={progressStats.completedLessons}
      totalLessons={progressStats.totalLessons}
      currentPathTitle={currentPathTitle}
      onPathClick={() => {
        if (traineePath) {
          navigate(\`/paths/\${traineePath.id}\`);
        }
      }}
    />
  </div>
</div>`;
const traineeRingRegex = /<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>[\s\S]*?<\/svg>\s*<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>\s*<span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{progressPercent}%<\/span>\s*<span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Complete<\/span>\s*<\/div>\s*<\/div>\s*<\/div>/;
content = content.replace(traineeRingRegex, ringCode);

// 4. Replace Trainee Streak Card
const streakCode = '<StreakCard currentStreak={currentStreak} />';
const traineeStreakRegex = /<div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>\s*<div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>🔥<\/div>\s*<div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>\s*{currentStreak} days\s*<\/div>\s*<div style={{ fontSize: '12px', color: '#64748b' }}>Current Streak<\/div>\s*<div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>\s*{currentStreak === 0 \? 'Submit a task to start!' : 'Keep it up!'}\s*<\/div>\s*<\/div>/;
content = content.replace(traineeStreakRegex, streakCode);

// 5. Replace Admin/Trainer Charts
const adminChartsCode = `<section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
  <DashboardCharts
    title="Progress Trends"
    subtitle="Submissions vs Completions from database"
    role={activeRole.toLowerCase()}
    type="progress"
    datasets={{
      daily: charts.dailyProgressTrends || [],
      weekly: charts.weeklyProgressTrends || charts.progressTrends || [],
      monthly: charts.yearlyProgressTrends || []
    }}
  />
  <DashboardCharts
    title="Avg. Evaluation Score"
    subtitle="Weekly average from database"
    role={activeRole.toLowerCase()}
    type="score"
    datasets={{
      daily: (charts.dailyScores || []).map((d) => ({ ...d, name: d.label, averageScore: d.averageScore || d.activityPoints })),
      weekly: (charts.weeklyScores || []).map((d) => ({ ...d, name: d.label, averageScore: d.averageScore || d.activityPoints })),
      monthly: (charts.monthlyScores || []).map((d) => ({ ...d, name: d.label, averageScore: d.averageScore || d.activityPoints }))
    }}
  />
</section>`;
const adminChartsRegex = /<section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>[\s\S]*?<\/section>/g;

let replacedAdminCharts = false;
content = content.replace(adminChartsRegex, (match) => {
  if (replacedAdminCharts || !match.includes('Progress Trends')) {
    return match;
  }
  replacedAdminCharts = true;
  return adminChartsCode;
});

fs.writeFileSync('src/pages/DashboardPage.tsx', content);
