import { BaseModel } from './base.model';
export interface SubmissionModel extends BaseModel {
    submissionType: string;
    githubUrl?: string;
    liveUrl?: string;
    notes?: string;
    status: string;
    submittedAt: Date;
}
