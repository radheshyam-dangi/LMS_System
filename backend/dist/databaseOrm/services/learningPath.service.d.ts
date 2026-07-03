import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LearningPathEntity } from '../entities/learningPath.entity';
export declare class LearningPathEntityService extends BaseService<LearningPathEntity> {
    protected repository: Repository<LearningPathEntity>;
    constructor(datasource: DataSource);
    /**
     * Custom Query Example: Find all live learning paths with their assigned modules
     */
    findActivePathsWithModules(): Promise<LearningPathEntity[]>;
}
