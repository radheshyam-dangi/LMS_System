import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
export declare class ModuleKeyPointEntity extends BaseEntity {
    title: string;
    description: string;
    module: ModuleEntity;
}
