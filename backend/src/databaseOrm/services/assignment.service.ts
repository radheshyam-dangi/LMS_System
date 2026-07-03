import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { AssignmentEntity } from '../entities/assignment.entity';

@Injectable()
export class AssignmentEntityService extends BaseService<AssignmentEntity> {
  protected repository: Repository<AssignmentEntity>;
  constructor(
    datasource:DataSource  
  ) {
    // Pass the injected repository up to the generic BaseService handler
    super();
    this.repository = datasource.getRepository<AssignmentEntity>(AssignmentEntity)
  }

  /**
   * Example Custom Query: Find all assignments belonging to a specific lesson
   */
  async findByLessonId(lessonId: string): Promise<AssignmentEntity[]> {
    return await this.repository.find({
      where: {
        lesson: { id: lessonId }
      } as any
    });
  }
}