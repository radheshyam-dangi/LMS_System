import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LessonEntity } from '../entities/lesson.entity';

@Injectable()
export class LessonService extends BaseService<LessonEntity> {
  constructor(
    @InjectRepository(LessonEntity)
    private readonly lessonRepository: Repository<LessonEntity>,
  ) {
    super(lessonRepository);
  }

  /**
   * Custom Query Example: Fetch lessons inside a module ordered by display position
   */
  async findByModuleId(moduleId: string): Promise<LessonEntity[]> {
    return await this.lessonRepository.find({
      where: { module: { id: moduleId } } as any,
      order: { displayOrder: 'ASC' } as any,
    });
  }
}