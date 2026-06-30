import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { LearningPathEntity } from './learningPath.entity';
import { LessonEntity } from './lesson.entity';
export declare class ModuleEntity extends BaseEntity {
    title: string;
    description: string;
    difficultyLevel: string;
    status: string;
    parent: ModuleEntity;
    subModules: ModuleEntity[];
    learningPath: LearningPathEntity;
    createdBy: UserEntity;
    lessons: LessonEntity[];
}
