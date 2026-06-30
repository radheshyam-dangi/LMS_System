import { BaseModel } from './base.model';
export interface ModuleModel extends BaseModel {
    title: string;
    description?: string;
    difficultyLevel?: string;
    status?: string;
}
