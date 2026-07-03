import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LessonEntity } from '../entities/lesson.entity';
import { DataSource } from 'typeorm';
export declare class LessonEntityService extends BaseService<LessonEntity> {
    protected repository: Repository<LessonEntity>;
    constructor(datasource: DataSource);
    /**
     * Custom Query Example: Fetch lessons inside a module ordered by display position
     */
    findByModuleId(moduleId: string): Promise<LessonEntity[]>;
}
