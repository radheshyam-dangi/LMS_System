import { DataSource } from 'typeorm';

async function check() {
  const ds = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'password', // might need to guess the password or look in app.module.ts
    database: 'lms_db',
  });
  
  await ds.initialize();
  const result = await ds.query("SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(c.oid) FROM pg_constraint c WHERE conname = 'UQ_185322f2e7928c3d1a2fd7233c6';");
  console.log(result);
  await ds.destroy();
}

check().catch(console.error);
