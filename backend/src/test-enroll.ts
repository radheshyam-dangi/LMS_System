import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AnalyticsEntityService } from './databaseOrm/modules/analytics/analytics.service';
import { getRepository } from 'typeorm';
import { EnrollmentEntity } from './databaseOrm/entities/enrollment.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const userId = 'f16c7645-c4a6-4cd1-a240-d0942a66c3c0';
  const enrollmentRepo = app.get('EnrollmentEntityRepository');
  
  const enrollments = await enrollmentRepo.find({
    where: { status: 'active', user: { id: userId } },
    relations: ['learningPath', 'user'],
  });
  console.log('Enrollments found:', enrollments.length);
  if (enrollments.length > 0) {
    console.log('First enrollment learningPath:', enrollments[0].learningPath);
  }
  
  await app.close();
}
bootstrap();
