import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningPathController } from './learningPath.controller';
import { LearningPathEntityService } from './learningPath.service';
import { LearningPathService } from './learningPathWrapper.service'; // Path matching your architecture directory
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { LearningPathModuleEntity } from "../../entities/learningPathModule.entity";
import { EnrollmentEntity } from "../../entities/enrollment.entity";

@Module({
  imports: [
    // TypeORM repositories injected into NestJS dependency container context safely
    TypeOrmModule.forFeature([
      LearningPathEntity, 
      LearningPathModuleEntity, 
      EnrollmentEntity
    ])
  ],
  controllers: [LearningPathController],
  providers: [
    LearningPathEntityService, 
    LearningPathService
  ],
  exports: [
    LearningPathEntityService, 
    LearningPathService
  ],
})
export class LearningPathModule {}