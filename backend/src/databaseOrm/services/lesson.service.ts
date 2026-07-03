import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LessonEntity } from '../entities/lesson.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class LessonEntityService extends BaseService<LessonEntity> {
  protected repository: Repository<LessonEntity>;
  constructor(
    datasource:DataSource
  ) {
    super();
    this.repository = datasource.getRepository<LessonEntity>(LessonEntity)
  }

  /**
   * Custom Query Example: Fetch lessons inside a module ordered by display position
   */
  async findByModuleId(moduleId: string): Promise<LessonEntity[]> {
    return await this.repository.find({
      where: { module: { id: moduleId } } as any,
      order: { displayOrder: 'ASC' } as any,
    });
  }
}