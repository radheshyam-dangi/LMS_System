import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LpAuthoringController } from './lpAuthoring.controller';
import { LpAuthoringService } from './lpAuthoring.service';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { ResourceEntity } from '../../entities/resource.entity';
import { LpDraftEntity } from '../../entities/lpDraft.entity';
import { AuthModule } from '../../auth/auth.module';
import { AiEvaluationModule } from '../aiEvaluation/aiEvaluation.module';
import { LearningPathModule } from '../learningPath/learningPath.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LearningPathEntity,
      ModuleEntity,
      LessonEntity,
      AssignmentEntity,
      ResourceEntity,
      LpDraftEntity,
    ]),
    AuthModule,
    forwardRef(() => AiEvaluationModule),
    forwardRef(() => LearningPathModule),
  ],
  controllers: [LpAuthoringController],
  providers: [LpAuthoringService],
  exports: [LpAuthoringService],
})
export class LpAuthoringModule {}
