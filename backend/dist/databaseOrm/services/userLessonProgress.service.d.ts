import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserLessonProgressEntity } from '../entities/userLessonProgress.entity';
export declare class UserLessonProgressService extends BaseService<UserLessonProgressEntity> {
    datasource: DataSource;
    protected repository: Repository<UserLessonProgressEntity>;
    constructor(datasource: DataSource);
    findProgressByUser(userId: string): Promise<UserLessonProgressEntity[]>;
}
