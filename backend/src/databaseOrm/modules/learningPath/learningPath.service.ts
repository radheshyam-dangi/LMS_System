import { Injectable } from '@nestjs/common';
import { LearningPathEntityService } from '../../services/learningPath.service';

@Injectable()
export class LearningPathService{
    constructor(private learningPathEntityService:LearningPathEntityService){}
}
export {LearningPathEntityService};