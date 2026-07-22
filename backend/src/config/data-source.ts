import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load the .env file explicitly for the TypeORM CLI
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'lms_db', 
  
  entities: [path.join(__dirname, '../databaseOrm/**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../databaseOrm/migrations/*{.ts,.js}')],
  synchronize: true, 

  
});

