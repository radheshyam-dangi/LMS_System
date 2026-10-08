const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { AssignmentService } = require('./dist/databaseOrm/modules/assignment/assignment.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const assignmentService = app.get(AssignmentService);
  const assignments = await assignmentService.findMyAssignments('f16c7645-c4a6-4cd1-a240-d0942a66c3c0'); // traineeId doesn't matter, just pass empty string to see if any are returned, or we know this trainee has assignments
  console.log(JSON.stringify(assignments.slice(0, 2), null, 2));
  await app.close();
}
bootstrap();
