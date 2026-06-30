import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { AssignmentEntity } from '../entities/assignment.entity';
export declare class AssignmentService extends BaseService<AssignmentEntity> {
    private readonly assignmentRepository;
    constructor(assignmentRepository: Repository<AssignmentEntity>);
    /**
     * Example Custom Query: Find all assignments belonging to a specific lesson
     */
    findByLessonId(lessonId: string): Promise<AssignmentEntity[]>;
}
