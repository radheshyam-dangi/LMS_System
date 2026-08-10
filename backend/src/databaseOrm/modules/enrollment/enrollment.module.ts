import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentEntityService } from './enrollment.service';
import { EnrollmentEntity } from '../../entities/enrollment.entity';
import { UserEntity } from '../../entities/user.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EnrollmentEntity, UserEntity, LearningPathEntity])],
  controllers: [EnrollmentController],
  providers: [EnrollmentEntityService],
  exports: [EnrollmentEntityService],
})
export class EnrollmentModule {}
