import { AppDataSource } from './src/config/data-source';
import { EnrollmentEntity } from './src/databaseOrm/entities/enrollment.entity';
import { AssignmentSubmissionEntity } from './src/databaseOrm/entities/assignmentSubmission.entity';

async function check() {
  await AppDataSource.initialize();
  const enrollments = await AppDataSource.getRepository(EnrollmentEntity).find({ relations: ['assignedBy', 'user', 'learningPath'] });
  console.log("ENROLLMENTS:");
  for (const e of enrollments) {
    console.log(`- Trainee: ${e.user?.id}, LP: ${e.learningPath?.id}, AssignedBy: ${e.assignedBy?.id}`);
  }

  const subs = await AppDataSource.getRepository(AssignmentSubmissionEntity).find({ relations: ['assignment', 'trainee'] });
  console.log("\nSUBMISSIONS:");
  for (const s of subs) {
    console.log(`- Sub: ${s.id}, Trainee: ${s.trainee?.id}, Assignment: ${s.assignment?.id}, Status: ${s.status}`);
  }
  process.exit(0);
}

check().catch(console.error);
