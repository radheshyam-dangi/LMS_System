import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { AssignmentEntity } from '../entities/assignment.entity';

@Injectable()
export class AssignmentService extends BaseService<AssignmentEntity> {
  constructor(
    @InjectRepository(AssignmentEntity)
    private readonly assignmentRepository: Repository<AssignmentEntity>,
  ) {
    // Pass the injected repository up to the generic BaseService handler
    super(assignmentRepository);
  }

  /**
   * Example Custom Query: Find all assignments belonging to a specific lesson
   */
  async findByLessonId(lessonId: string): Promise<AssignmentEntity[]> {
    return await this.assignmentRepository.find({
      where: {
        lesson: { id: lessonId }
      } as any
    });
  }
}