const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:Postgres@1234@localhost:5432/lms_db' });
c.connect()
  .then(() => c.query('SELECT id, status, attempts, submission_id FROM "EvaluationJob"'))
  .then(r => console.log(r.rows))
  .catch(e => console.error(e))
  .finally(() => c.end());
