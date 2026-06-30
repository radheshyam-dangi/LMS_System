import { Injectable } from '@nestjs/common';
import { EvaluationService as MainEvaluationService } from '../../services/evaluation.service';

@Injectable()
export class EvaluationService extends MainEvaluationService {}