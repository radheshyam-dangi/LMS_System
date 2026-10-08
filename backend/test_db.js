const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: 'Postgres@1234', host: 'localhost', port: 5432, database: 'lms_db' });
client.connect();
client.query('SELECT * FROM "Assignment" LIMIT 1', (err, res) => {
  console.log(err ? err : JSON.stringify(res.rows, null, 2));
  client.end();
});
