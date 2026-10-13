const { DataSource } = require('typeorm');
const ds = new DataSource({
  type: 'postgres',
  url: 'postgresql://postgres:Postgres@1234@localhost:5432/lms_db'
});
ds.initialize().then(async () => {
  const res = await ds.query('SELECT id, submission_text FROM "AssignmentSubmission" ORDER BY submitted_at DESC NULLS LAST LIMIT 5');
  console.log('--- RECENT SUBMISSIONS ---');
  res.forEach(r => {
    console.log(`ID: ${r.id}`);
    console.log(`Text: ${r.submission_text}`);
    console.log('---------------------------');
  });
  process.exit(0);
}).catch(console.error);
