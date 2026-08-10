import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { EvaluationEntity } from '../entities/evaluation.entity';

@Injectable()
export class EvaluationEntitytService extends BaseService<EvaluationEntity> {
  protected repository: Repository<EvaluationEntity>;
  constructor(
    datasource : DataSource  
  ) {
    super();
    this.repository = datasource.getRepository<EvaluationEntity>(EvaluationEntity)
  }
}