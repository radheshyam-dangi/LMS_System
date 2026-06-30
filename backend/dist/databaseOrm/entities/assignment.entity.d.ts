import { BaseEntity } from './base.entity';
import { LessonEntity } from './lesson.entity';
import { UserEntity } from './user.entity';
export declare class AssignmentEntity extends BaseEntity {
    title: string;
    description: string;
    instructions: string;
    difficultyLevel: string;
    assignmentType: string;
    maxScore: number;
    dueDate: Date;
    lesson: LessonEntity;
    createdBy: UserEntity;
}
