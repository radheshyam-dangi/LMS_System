import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './config/data-source'; // Import our new data source

import { UserModule } from './databaseOrm/modules/user/user.module';
import { RoleModule } from './databaseOrm/modules/role/role.module';
import { AssignmentModule } from './databaseOrm/modules/assignment/assignment.module';
import { LessonModule } from './databaseOrm/modules/lesson/lesson.module';
import { LearningPathModule } from './databaseOrm/modules/learningPath/learningPath.module';
import { ModuleModule } from './databaseOrm/modules/module/module.module';
import { EvaluationModule } from './databaseOrm/modules/evaluation/evaluation.module';
import { DocumentModule } from './databaseOrm/modules/document/document.module';
import { SubmissionModule } from './databaseOrm/modules/submission/submission.module';
import { TagModule } from './databaseOrm/modules/tag/tag.module';
import { EmailModule } from './databaseOrm/modules/email/email.module';
import { AuthModule } from './databaseOrm/auth/auth.module';
import { ResourceModule } from './databaseOrm/modules/resource/resource.module';
import { EnrollmentModule } from './databaseOrm/modules/enrollment/enrollment.module';
import { ProgressModule } from './databaseOrm/modules/progress/progress.module';
import { AiModule } from './databaseOrm/modules/ai/ai.module';
import { AnalyticsModule } from './databaseOrm/modules/analytics/analytics.module';
import { NotificationModule } from './databaseOrm/modules/notification/notification.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './databaseOrm/modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Pass the AppDataSource options directly into TypeOrmModule
    TypeOrmModule.forRoot(AppDataSource.options),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    HealthModule,

    UserModule,
    RoleModule,
    AssignmentModule,
    LessonModule,
    LearningPathModule,
    ModuleModule,
    EvaluationModule,
    DocumentModule,
    SubmissionModule,
    TagModule,
    EmailModule,
    AuthModule,
    ResourceModule,
    EnrollmentModule,
    ProgressModule,
    AiModule,
    AnalyticsModule,
    NotificationModule,
  ],
})
export class AppModule {}
