const { Client } = require('pg');

async function audit() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'lms_db',
    password: 'Postgres@1234',
    port: 5432,
  });

  await client.connect();

  const res = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_schema='public'
  `);
  console.table(res.rows);

  await client.end();
}

audit().catch(console.error);
