import { BaseModel } from './base.model';

export interface UserLessonProgressModel extends BaseModel {
  completedAt: Date;
}