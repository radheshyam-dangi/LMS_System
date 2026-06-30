import { BaseModel } from './base.model';
export interface AssignmentModel extends BaseModel {
    title: string;
    description?: string;
    instructions?: string;
    difficultyLevel?: string;
    assignmentType?: string;
    maxScore?: number;
    dueDate?: Date;
}
