import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentController } from './assignment.controller';
import { AssignmentEntityService } from './assignment.service';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { TraineeAssignmentEntity } from '../../entities/traineeAssignment.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssignmentEntity, AssignmentSubmissionEntity, TraineeAssignmentEntity]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [AssignmentController],
  providers: [AssignmentEntityService],
  exports: [AssignmentEntityService],
})
export class AssignmentModule {}
