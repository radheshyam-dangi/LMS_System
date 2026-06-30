import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { LessonEntity } from '../../entities/lesson.entity';
import { UserLessonProgressEntity } from '../../entities/userLessonProgress.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LessonEntity,UserLessonProgressEntity])
  ],
  controllers: [LessonController],
  providers: [LessonService],
  exports: [LessonService],
})
export class LessonModule {}