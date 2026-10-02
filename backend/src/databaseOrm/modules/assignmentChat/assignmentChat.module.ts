import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentChatController } from './assignmentChat.controller';
import { AssignmentChatService } from './assignmentChat.service';
import { AssignmentChatThreadEntity } from '../../entities/assignmentChatThread.entity';
import { AssignmentChatMessageEntity } from '../../entities/assignmentChatMessage.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { QuestionLessonDependencyEntity } from '../../entities/questionLessonDependency.entity';
import { LessonContentChunkEntity } from '../../entities/lessonContentChunk.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssignmentChatThreadEntity,
      AssignmentChatMessageEntity,
      AssignmentEntity,
      QuestionLessonDependencyEntity,
      LessonContentChunkEntity,
      AssignmentSubmissionEntity,
    ]),
    NotificationModule,
  ],
  controllers: [AssignmentChatController],
  providers: [AssignmentChatService],
  exports: [AssignmentChatService],
})
export class AssignmentChatModule {}
