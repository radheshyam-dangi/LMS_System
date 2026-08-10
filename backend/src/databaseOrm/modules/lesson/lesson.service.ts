import { Injectable } from '@nestjs/common';
import { LessonEntityService} from '../../services/lesson.service';

@Injectable()
export class LessonService {
    constructor(private lessonEntityService:LessonEntityService){}
}
export {LessonEntityService}
