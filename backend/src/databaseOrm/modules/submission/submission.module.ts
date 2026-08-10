import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionController } from './submission.controller';
import { SubmissionEntityService } from './submission.service';
import { SubmissionEntity } from '../../entities/submission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SubmissionEntity])],
  controllers: [SubmissionController],
  providers: [SubmissionEntityService],
  exports: [SubmissionEntityService],
})
export class SubmissionModule {}