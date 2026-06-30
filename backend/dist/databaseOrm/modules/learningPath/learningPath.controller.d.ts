import { LearningPathService } from './learningPath.service';
import type { LearningPathModel } from '../../../types/models/learningPath.model';
export declare class LearningPathController {
    private readonly learningPathService;
    constructor(learningPathService: LearningPathService);
    create(dto: LearningPathModel): Promise<import("../../entities/learningPath.entity").LearningPathEntity>;
    findAll(): Promise<import("../../entities/learningPath.entity").LearningPathEntity[]>;
    findOne(id: string): Promise<import("../../entities/learningPath.entity").LearningPathEntity | null>;
    update(id: string, dto: Partial<LearningPathModel>): Promise<import("../../entities/learningPath.entity").LearningPathEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
