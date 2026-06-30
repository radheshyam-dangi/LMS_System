import { BaseModel } from './base.model';
export interface LessonModel extends BaseModel {
    title: string;
    description?: string;
    durationMinutes?: number;
    displayOrder?: number;
}
