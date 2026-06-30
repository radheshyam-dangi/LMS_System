import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningPathController } from './learningPath.controller';
import { LearningPathService } from './learningPath.service';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { LearningPathModuleEntity} from "../../entities/learningPathModule.entity"
import {EnrollmentEntity} from "../../entities/enrollment.entity"

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningPathEntity,LearningPathModuleEntity,EnrollmentEntity])
  ],
  controllers: [LearningPathController],
  providers: [LearningPathService],
  exports: [LearningPathService],
})
export class LearningPathModule {}