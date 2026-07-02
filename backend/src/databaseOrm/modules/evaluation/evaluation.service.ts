import { Injectable } from '@nestjs/common';
import { EvaluationEntitytService} from '../../services/evaluation.service';

@Injectable()
export class EvaluationService{
    constructor(
        private EvaluationEntityService : EvaluationEntitytService){}
    
}
export {EvaluationEntitytService}