import { BaseEntity } from './base.entity';
import type { ModuleTagEntity as ModuleTagEntityType } from './moduleTag.entity';
export declare class TagEntity extends BaseEntity {
    name: string;
    moduleTags: ModuleTagEntityType[];
}
