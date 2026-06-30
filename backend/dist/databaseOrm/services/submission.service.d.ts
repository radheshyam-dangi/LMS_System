import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { SubmissionEntity } from '../entities/submission.entity';
export declare class SubmissionService extends BaseService<SubmissionEntity> {
    private readonly submissionRepository;
    constructor(submissionRepository: Repository<SubmissionEntity>);
    findSubmissionsByUser(userId: string): Promise<SubmissionEntity[]>;
}
