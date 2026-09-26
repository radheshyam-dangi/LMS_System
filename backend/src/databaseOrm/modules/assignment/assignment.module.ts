import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentController } from './assignment.controller';
import { AssignmentEntityService } from './assignment.service';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { TraineeAssignmentEntity } from '../../entities/traineeAssignment.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { QuestionLessonDependencyEntity } from '../../entities/questionLessonDependency.entity';
import { NotificationModule } from '../notification/notification.module';
// B1: Import AiEvaluationModule to enable proper DI injection
import { AiEvaluationModule } from '../aiEvaluation/aiEvaluation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssignmentEntity,
      AssignmentSubmissionEntity,
      TraineeAssignmentEntity,
      LessonEntity,
      ModuleEntity,
      QuestionLessonDependencyEntity,
    ]),
    forwardRef(() => NotificationModule),
    // B1: forwardRef to avoid circular dependency with AiEvaluationModule
    forwardRef(() => AiEvaluationModule),
  ],
  controllers: [AssignmentController],
  providers: [AssignmentEntityService],
  exports: [AssignmentEntityService],
})
export class AssignmentModule {}

