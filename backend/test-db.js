const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: 'Postgres@1234', host: 'localhost', port: 5432, database: 'lms_db' });
client.connect().then(() => client.query('SELECT id, title, video_url, videos, updated_at FROM "Lesson" ORDER BY updated_at DESC LIMIT 5')).then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
  client.end();
}).catch(console.error);
