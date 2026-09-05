const { Client } = require('pg');
const client = new Client({ user: 'postgres', host: 'localhost', database: 'lms_db', password: 'Postgres@1234', port: 5432 });

async function check() {
  await client.connect();
  const userId = 'f16c7645-c4a6-4cd1-a240-d0942a66c3c0';
  const roleJunctions = await client.query(`SELECT * FROM "UserRoles" WHERE "userId" = '${userId}'`);
  console.log('Role Junctions:', roleJunctions.rows);
  
  if (roleJunctions.rows.length > 0) {
    const roleIds = roleJunctions.rows.map(r => `'${r.roleId}'`).join(',');
    const roles = await client.query(`SELECT * FROM "Role" WHERE id IN (${roleIds})`);
    console.log('Roles:', roles.rows);
  }
  
  await client.end();
}
check().catch(console.error);
