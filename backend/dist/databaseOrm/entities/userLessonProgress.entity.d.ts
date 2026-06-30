import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { LessonEntity } from './lesson.entity';
export declare class UserLessonProgressEntity extends BaseEntity {
    completedAt: Date;
    user: UserEntity;
    lesson: LessonEntity;
}
