import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: ["src/databaseOrm/entities/*.ts"],
    synchronize: false,
});

async function run() {
    await AppDataSource.initialize();
    
    const submissions = await AppDataSource.query(`SELECT * FROM "AssignmentSubmission" LIMIT 10`);
    console.log("AssignmentSubmission sample:", submissions.map((s: any) => ({ id: s.id, score: s.score, trainee_id: s.trainee_id })));
    
    const legacySubs = await AppDataSource.query(`SELECT * FROM "submission" LIMIT 10`);
    console.log("Legacy Submission sample:", legacySubs.map((s: any) => ({ id: s.id, status: s.status, userId: s.userId })));
    
    const evaluations = await AppDataSource.query(`SELECT * FROM "EvaluationEntity" LIMIT 10`);
    console.log("EvaluationEntity sample:", evaluations.map((e: any) => ({ id: e.id, overallScore: e.overallScore, submissionId: e.submissionId })));

    process.exit(0);
}

run().catch(console.error);
