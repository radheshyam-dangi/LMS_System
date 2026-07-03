import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { AssignmentEntity } from '../entities/assignment.entity';
export declare class AssignmentEntityService extends BaseService<AssignmentEntity> {
    protected repository: Repository<AssignmentEntity>;
    constructor(datasource: DataSource);
    /**
     * Example Custom Query: Find all assignments belonging to a specific lesson
     */
    findByLessonId(lessonId: string): Promise<AssignmentEntity[]>;
}
