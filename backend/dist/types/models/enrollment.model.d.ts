import { BaseModel } from './base.model';
export interface EnrollmentModel extends BaseModel {
    enrolledAt: Date;
    status: string;
}
