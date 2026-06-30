import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
export declare class ModulePrerequisiteEntity extends BaseEntity {
    module: ModuleEntity;
    prerequisiteModule: ModuleEntity;
}
