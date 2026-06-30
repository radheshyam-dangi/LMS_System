import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { LearningPathEntity } from './learningPath.entity';
export declare class EnrollmentEntity extends BaseEntity {
    enrolledAt: Date;
    status: string;
    user: UserEntity;
    learningPath: LearningPathEntity;
}
