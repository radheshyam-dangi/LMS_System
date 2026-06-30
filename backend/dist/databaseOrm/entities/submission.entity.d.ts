import { BaseEntity } from './base.entity';
import { AssignmentEntity } from './assignment.entity';
import { UserEntity } from './user.entity';
import { EvaluationEntity } from './evaluation.entity';
export declare class SubmissionEntity extends BaseEntity {
    submissionType: string;
    githubUrl: string;
    liveUrl: string;
    notes: string;
    status: string;
    submittedAt: Date;
    assignment: AssignmentEntity;
    user: UserEntity;
    evaluations: EvaluationEntity[];
}
