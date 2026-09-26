const { Client } = require('pg'); 
const c = new Client({ connectionString: 'postgresql://postgres:Postgres@1234@localhost:5432/lms_db' }); 
c.connect().then(() => c.query(`SELECT id, title, depends_on_lesson_ids, lock_until_lessons_complete FROM "Assignment" WHERE title LIKE '%Assignment%'`)).then(r => console.log(r.rows)).finally(() => c.end());
