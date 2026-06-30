import { BaseModel } from './base.model';
export interface EvaluationModel extends BaseModel {
    technicalScore: number;
    architectureScore: number;
    problemSolvingScore: number;
    documentationScore: number;
    overallScore: number;
    feedback: string;
}
