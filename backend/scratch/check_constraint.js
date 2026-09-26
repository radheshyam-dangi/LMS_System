const { Client } = require('pg');

async function check() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'lms_db',
    password: 'Postgres@1234',
    port: 5432,
  });
  
  await client.connect();
  const res = await client.query("SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(c.oid) FROM pg_constraint c WHERE conname = 'UQ_185322f2e7928c3d1a2fd7233c6';");
  console.log(res.rows);
  await client.end();
}

check().catch(console.error);
