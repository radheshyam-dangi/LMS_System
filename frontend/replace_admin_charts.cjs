const fs = require('fs');

let content = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');
const lines = content.split('\n');

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

const newLines = [];
let skip = false;
let replaced = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (!replaced && line.includes('<section style={{ display: \'grid\', gridTemplateColumns: \'2fr 1fr\', gap: \'20px\', marginBottom: \'24px\' }}>')) {
    skip = true;
    newLines.push(adminChartsCode);
    continue;
  }

  if (skip && line.includes('</section>')) {
    skip = false;
    replaced = true;
    continue;
  }

  if (!skip) {
    newLines.push(line);
  }
}

fs.writeFileSync('src/pages/DashboardPage.tsx', newLines.join('\n'));
