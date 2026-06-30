import { BaseEntity } from './base.entity';
import { SubmissionEntity } from './submission.entity';
import { UserEntity } from './user.entity';
export declare class EvaluationEntity extends BaseEntity {
    technicalScore: number;
    architectureScore: number;
    problemSolvingScore: number;
    documentationScore: number;
    overallScore: number;
    feedback: string;
    submission: SubmissionEntity;
    evaluator: UserEntity;
}
