import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningPathController } from './learningPath.controller';
import { LearningPathEntityService } from './learningPath.service';
import { LearningPathService } from './learningPathWrapper.service';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { AuthModule } from '../../auth/auth.module';
import { LearningPathModuleEntity } from '../../entities/learningPathModule.entity';
import { EnrollmentEntity } from '../../entities/enrollment.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LearningPathEntity,
      LearningPathModuleEntity,
      EnrollmentEntity,
    ]),
    AuthModule,
    forwardRef(() => NotificationModule),
  ],
  controllers: [LearningPathController],
  providers: [LearningPathEntityService, LearningPathService],
  exports: [LearningPathEntityService, LearningPathService],
})
export class LearningPathModule {}
