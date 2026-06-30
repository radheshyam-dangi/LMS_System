import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { EvaluationEntity } from '../entities/evaluation.entity';
export declare class EvaluationService extends BaseService<EvaluationEntity> {
    private readonly evaluationRepository;
    constructor(evaluationRepository: Repository<EvaluationEntity>);
}
