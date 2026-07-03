import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { EvaluationEntity } from '../entities/evaluation.entity';
export declare class EvaluationEntitytService extends BaseService<EvaluationEntity> {
    protected repository: Repository<EvaluationEntity>;
    constructor(datasource: DataSource);
}
