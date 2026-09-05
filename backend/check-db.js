const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'Postgres@1234',
    database: 'lms_db',
  });
  await client.connect();
  
  // Find tables to check their actual names
  const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  console.log("Tables:", tables.rows.map(r => r.table_name));

  const pathName = 'LearningPathEntity';
  const modName = 'ModuleEntity';

  const pathRes = await client.query(`SELECT id, title, status FROM "LearningPathEntity" WHERE title = 'Data science'`);
  console.log("Path:", pathRes.rows[0]);
  
  if (pathRes.rows.length > 0) {
    const modulesRes = await client.query(`SELECT id, title, status FROM "ModuleEntity" WHERE "learningPathId" = $1`, [pathRes.rows[0].id]);
    console.log("Modules attached to this path:", modulesRes.rows);
  }
  
  await client.end();
}

run().catch(console.error);
