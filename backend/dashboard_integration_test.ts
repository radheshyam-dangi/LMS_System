import { AppDataSource } from './src/config/data-source';
import { AnalyticsEntityService } from './src/databaseOrm/modules/analytics/analytics.service';
import { UserEntity } from './src/databaseOrm/entities/user.entity';
import { RoleEntity } from './src/databaseOrm/entities/role.entity';
import { LearningPathEntity } from './src/databaseOrm/entities/learningPath.entity';
import { AssignmentEntity } from './src/databaseOrm/entities/assignment.entity';
import { EnrollmentEntity } from './src/databaseOrm/entities/enrollment.entity';

async function runTest() {
  await AppDataSource.initialize();
  const analyticsService = new AnalyticsEntityService(AppDataSource);

  const userRepo = AppDataSource.getRepository(UserEntity);
  const roleRepo = AppDataSource.getRepository(RoleEntity);

  console.log('Testing Trainer Dashboard Summaries...');
  
  // Create a mock user if testing against real db
  const trainers = await userRepo.find({
    relations: ['roles', 'primaryRole']
  });
  
  const trainer = trainers.find((t: UserEntity) => 
    t.primaryRole?.name === 'Trainer' || 
    t.roles?.some((r: RoleEntity) => r.name === 'Trainer')
  );

  if (!trainer) {
    console.log('No trainer found to test with.');
    process.exit(0);
  }

  console.log(`Running getTrainerDashboardSummaryV2 for trainer: ${trainer.email}`);
  const summary = await analyticsService.getTrainerDashboardSummaryV2(trainer);
  
  console.log('\n--- DASHBOARD SUMMARY RESULTS ---');
  console.log(`Total Platform Trainees: ${summary.platformTotalTrainees}`);
  console.log(`Total Platform Trainers: ${summary.platformTotalTrainers}`);
  console.log(`LPs Created: ${summary.trainerLpsCreated}`);
  console.log(`Assignments Created: ${summary.trainerAssignments.total} (Internal: ${summary.trainerAssignments.internal}, External: ${summary.trainerAssignments.external})`);
  console.log(`My Trainees Count: ${summary.totalTrainees}`);
  console.log(`Assigned LPs & Progress Count: ${summary.assignedTraineesProgress.length}`);
  console.log(`Average Score: ${summary.averageScore}`);
  console.log(`Completion Rate: ${summary.completionRate}`);
  console.log(`Training Effectiveness: ${summary.trainingEffectiveness}`);
  console.log(`Pending Reviews: ${summary.trainerPendingReviews}`);

  console.log('\n--- DETAILED PROGRESS DUMP ---');
  console.log(JSON.stringify(summary.assignedTraineesProgress.slice(0, 2), null, 2));

  // Assertions (Section 4 invariants)
  if (summary.totalTrainees > 0 && summary.assignedTraineesProgress.length === 0) {
    throw new Error('ASSERTION FAILED: My Trainees > 0 but assignedTraineesProgress is empty.');
  }

  if (summary.platformTotalTrainees < summary.totalTrainees) {
    throw new Error('ASSERTION FAILED: Total Platform Trainees is less than My Trainees.');
  }

  if (summary.platformTotalTrainers < 1) {
    throw new Error('ASSERTION FAILED: Total Platform Trainers must be >= 1.');
  }

  if (summary.completionRate > 0 && summary.trainerAssignments.total === 0) {
    throw new Error('ASSERTION FAILED: Avg. Completion Rate > 0 implies Assignments Created > 0.');
  }

  const expectedEffectiveness = Math.round(0.5 * summary.completionRate + 0.5 * (summary.averageScore || 0));
  if (summary.trainingEffectiveness !== expectedEffectiveness) {
    throw new Error(`ASSERTION FAILED: Training Effectiveness is ${summary.trainingEffectiveness}, expected ${expectedEffectiveness}.`);
  }

  console.log('\n✅ All integration assertions passed.');
  await AppDataSource.destroy();
}

runTest().catch(console.error);
