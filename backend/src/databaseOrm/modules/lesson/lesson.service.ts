import { Injectable } from '@nestjs/common';
import { LessonService as MainLessonService } from '../../services/lesson.service';

@Injectable()
export class LessonService extends MainLessonService {}