import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { ModuleEntity } from './module.entity';
export declare class LearningPathEntity extends BaseEntity {
    title: string;
    description: string;
    status: string;
    createdBy: UserEntity;
    modules: ModuleEntity[];
}
