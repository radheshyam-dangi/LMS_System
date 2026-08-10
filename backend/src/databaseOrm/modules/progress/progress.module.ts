import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressController } from './progress.controller';
import { ProgressEntityService } from './progress.service';
import { UserLessonProgressEntity } from '../../entities/userLessonProgress.entity';
import { UserResourceVisitEntity } from '../../entities/userResourceVisit.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { ResourceEntity } from '../../entities/resource.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserLessonProgressEntity,
      UserResourceVisitEntity,
      LessonEntity,
      ResourceEntity,
      AssignmentEntity,
      AssignmentSubmissionEntity,
      LearningPathEntity,
    ]),
  ],
  controllers: [ProgressController],
  providers: [ProgressEntityService],
  exports: [ProgressEntityService],
})
export class ProgressModule {}
