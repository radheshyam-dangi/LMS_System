import { Injectable } from '@nestjs/common';
import { LearningPathService as MainLearningPathService } from '../../services/learningPath.service';

@Injectable()
export class LearningPathService extends MainLearningPathService {}