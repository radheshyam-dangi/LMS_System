import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiEvaluationController } from './aiEvaluation.controller';
import { AiEvaluationService } from './aiEvaluation.service';
import { EvaluationWorkerService } from './evaluationWorker.service';
import { ContentExtractionService } from './contentExtraction.service';
import { Bm25Service } from './bm25.service';
import { EvaluationContextBuilderService } from './evaluationContext.service';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { LessonContentCacheEntity } from '../../entities/lessonContentCache.entity';
import { AuthModule } from '../../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssignmentEntity,
      AssignmentSubmissionEntity,
      LessonEntity,
      LessonContentCacheEntity,
    ]),
    AuthModule,
    forwardRef(() => NotificationModule),
  ],
  controllers: [AiEvaluationController],
  providers: [
    AiEvaluationService,
    EvaluationWorkerService,
    ContentExtractionService,
    EvaluationContextBuilderService,
    Bm25Service,
    // B1: Named token so AssignmentService can inject via @Inject('AiEvaluationService')
    { provide: 'AiEvaluationService', useExisting: AiEvaluationService },
  ],
  exports: [AiEvaluationService, EvaluationWorkerService, ContentExtractionService, EvaluationContextBuilderService, 'AiEvaluationService'],
})
export class AiEvaluationModule {}

