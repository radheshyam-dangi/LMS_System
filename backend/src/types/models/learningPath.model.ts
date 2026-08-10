import { BaseModel } from './base.model';

export interface LearningPathModel extends BaseModel {
  title: string;
  description?: string;
  status?: string;
}