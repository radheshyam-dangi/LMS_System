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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, 
    }),

    // Pass the AppDataSource options directly into TypeOrmModule
    TypeOrmModule.forRoot(AppDataSource.options),

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
    AuthModule
  ],
})
export class AppModule {}
