const { DataSource } = require('typeorm');
const axios = require('axios');
const fs = require('fs');

async function run() {
  try {
    const db = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'Postgres@1234',
      database: 'lms_db',
    });
    await db.initialize();
    const res = await db.query(`SELECT email FROM "User" JOIN "UserRoles" ON "User".id = "UserRoles"."userId" JOIN "Role" ON "Role".id = "UserRoles"."roleId" WHERE "Role".name = 'Trainee' LIMIT 1`);
    if(res.length === 0) { console.log('no trainee'); return; }
    
    const email = res[0].email;
    const loginRes = await axios.post('http://localhost:3000/v1/auth/login', { email, password: 'password123' }).catch(e => e.response);
    if(loginRes.status !== 201 && loginRes.status !== 200) {
      console.log('login failed', loginRes.status);
      return;
    }
    
    const token = loginRes.data.accessToken;
    const assignRes = await axios.get('http://localhost:3000/v1/assignments/my-assignments', {
      headers: { 'Authorization': `Bearer ${token}`, 'x-active-role': 'Trainee' }
    });
    console.log(JSON.stringify(assignRes.data.slice(0, 3), null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
