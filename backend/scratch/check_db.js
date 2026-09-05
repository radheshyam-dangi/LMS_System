const { Client } = require('pg'); 
const c = new Client({ connectionString: 'postgresql://postgres:Postgres@1234@localhost:5432/lms_db' }); 
c.connect().then(() => c.query('SELECT name FROM "Role"')).then(r => console.log(r.rows)).finally(() => c.end());
