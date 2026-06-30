import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LearningPathEntity } from '../entities/learningPath.entity';
export declare class LearningPathService extends BaseService<LearningPathEntity> {
    private readonly learningPathRepository;
    constructor(learningPathRepository: Repository<LearningPathEntity>);
    /**
     * Custom Query Example: Find all live learning paths with their assigned modules
     */
    findActivePathsWithModules(): Promise<LearningPathEntity[]>;
}
