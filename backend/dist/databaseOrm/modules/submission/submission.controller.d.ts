import { SubmissionEntityService } from './submission.service';
import type { SubmissionModel } from '../../../types/models/submission.model';
export declare class SubmissionController {
    private readonly submissionService;
    constructor(submissionService: SubmissionEntityService);
    create(dto: SubmissionModel): Promise<import("../../entities/submission.entity").SubmissionEntity>;
    findAll(): Promise<import("../../entities/submission.entity").SubmissionEntity[]>;
    findOne(id: string): Promise<import("../../entities/submission.entity").SubmissionEntity | null>;
    update(id: string, dto: Partial<SubmissionModel>): Promise<import("../../entities/submission.entity").SubmissionEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
