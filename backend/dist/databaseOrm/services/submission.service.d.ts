import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { SubmissionEntity } from '../entities/submission.entity';
export declare class SubmissionEntityService extends BaseService<SubmissionEntity> {
    protected repository: Repository<SubmissionEntity>;
    constructor(datasource: DataSource);
    findSubmissionsByUser(userId: string): Promise<SubmissionEntity[]>;
}
