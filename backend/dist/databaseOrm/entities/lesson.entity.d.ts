import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { AssignmentEntity } from './assignment.entity';
export declare class LessonEntity extends BaseEntity {
    title: string;
    description: string;
    durationMinutes: number;
    displayOrder: number;
    module: ModuleEntity;
    assignments: AssignmentEntity[];
}
