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

  console.log("--- 1. Trainees and Trainers ---");
  const res1 = await client.query(`
    SELECT r.name as role_name, COUNT(ur."userId") as total
    FROM role r
    JOIN user_roles_role ur ON r.id = ur."roleId"
    GROUP BY r.name
  `);
  console.table(res1.rows);

  console.log("--- 2. Assignments grouped by Trainer ---");
  const res2 = await client.query(`
    SELECT a."createdBy", COUNT(a.id) as total_assignments,
           COUNT(CASE WHEN a.is_external = true THEN 1 END) as external,
           COUNT(CASE WHEN a.is_external = false THEN 1 END) as internal
    FROM assignment a
    GROUP BY a."createdBy"
  `);
  console.table(res2.rows);

  console.log("--- 3. LPs grouped by Trainer ---");
  const res3 = await client.query(`
    SELECT "createdBy", COUNT(id) as total_lps
    FROM learning_path
    GROUP BY "createdBy"
  `);
  console.table(res3.rows);

  console.log("--- 4. My Trainees Logic (Distinct Trainees Assigned to Trainer) ---");
  const res4 = await client.query(`
    SELECT u.id as trainer_id, u.email as trainer_email, COUNT(DISTINCT a.trainee_id) as assigned_trainees_count
    FROM "user" u
    LEFT JOIN (
      -- Trainees from direct assignment in LP
      SELECT lp."createdBy" as trainer_id, jsonb_array_elements_text(lp.assigned_to_trainee_ids) as trainee_id
      FROM learning_path lp
      WHERE lp.assigned_to_trainee_ids IS NOT NULL AND jsonb_array_length(lp.assigned_to_trainee_ids) > 0
      UNION
      -- Trainees enrolled in LPs
      SELECT lp."createdBy" as trainer_id, e."userId"::text as trainee_id
      FROM learning_path lp
      JOIN enrollment e ON lp.id = e."learningPathId"
      UNION
      -- Trainees assigned directly to assignments
      SELECT a."createdBy" as trainer_id, jsonb_array_elements_text(a.assigned_to_trainee_ids) as trainee_id
      FROM assignment a
      WHERE a.assigned_to_trainee_ids IS NOT NULL AND jsonb_array_length(a.assigned_to_trainee_ids) > 0
    ) a ON a.trainer_id = u.id
    JOIN user_roles_role ur ON u.id = ur."userId"
    JOIN role r ON ur."roleId" = r.id
    WHERE r.name = 'Trainer'
    GROUP BY u.id, u.email
  `);
  console.table(res4.rows);

  await client.end();
}

audit().catch(console.error);
