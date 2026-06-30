import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { EvaluationEntity } from '../entities/evaluation.entity';

@Injectable()
export class EvaluationService extends BaseService<EvaluationEntity> {
  constructor(
    @InjectRepository(EvaluationEntity)
    private readonly evaluationRepository: Repository<EvaluationEntity>,
  ) {
    super(evaluationRepository);
  }
}