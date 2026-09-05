const { Client } = require('pg'); 
const c = new Client({ connectionString: 'postgresql://postgres:Postgres@1234@localhost:5432/lms_db' }); 
c.connect().then(() => c.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM "User" u
      JOIN "UserRoles" ur ON u.id = ur."userId"
      JOIN "Role" r ON ur."roleId" = r.id
      WHERE r.name = 'Trainee'
`)).then(r => console.log(r.rows)).finally(() => c.end());
