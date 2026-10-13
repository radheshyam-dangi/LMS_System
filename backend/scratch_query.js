const { DataSource } = require('typeorm');
const ds = new DataSource({ type: 'postgres', url: 'postgresql://postgres:postgres@localhost:5432/lms_db' });
ds.initialize().then(async () => {
  const res = await ds.query('SELECT id, submission_text, answers FROM "AssignmentSubmission" ORDER BY submitted_at DESC NULLS LAST LIMIT 5');
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}).catch(console.error);
