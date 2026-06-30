import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserLessonProgressEntity } from '../entities/userLessonProgress.entity';
export declare class UserLessonProgressService extends BaseService<UserLessonProgressEntity> {
    private readonly progressRepository;
    constructor(progressRepository: Repository<UserLessonProgressEntity>);
    findProgressByUser(userId: string): Promise<UserLessonProgressEntity[]>;
}
