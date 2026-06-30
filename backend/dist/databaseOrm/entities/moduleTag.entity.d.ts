import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { TagEntity } from './tag.entity';
export declare class ModuleTagEntity extends BaseEntity {
    module: ModuleEntity;
    tag: TagEntity;
}
