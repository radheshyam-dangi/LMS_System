import { BaseEntity } from './base.entity';
import { LearningPathEntity } from './learningPath.entity';
import { ModuleEntity } from './module.entity';
export declare class LearningPathModuleEntity extends BaseEntity {
    displayOrder: number;
    learningPath: LearningPathEntity;
    module: ModuleEntity;
}
