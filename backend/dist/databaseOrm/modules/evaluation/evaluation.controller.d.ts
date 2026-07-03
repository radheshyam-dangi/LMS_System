import { EvaluationEntitytService } from './evaluation.service';
import type { EvaluationModel } from '../../../types/models/evaluation.model';
export declare class EvaluationController {
    private readonly evaluationService;
    constructor(evaluationService: EvaluationEntitytService);
    create(dto: EvaluationModel): Promise<import("../../entities/evaluation.entity").EvaluationEntity>;
    findAll(): Promise<import("../../entities/evaluation.entity").EvaluationEntity[]>;
    findOne(id: string): Promise<import("../../entities/evaluation.entity").EvaluationEntity | null>;
    update(id: string, dto: Partial<EvaluationModel>): Promise<import("../../entities/evaluation.entity").EvaluationEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
