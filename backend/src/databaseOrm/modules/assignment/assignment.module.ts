import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';
import { AssignmentEntity } from '../../entities/assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AssignmentEntity])],
  controllers: [AssignmentController],
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}