import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { LessonEntity } from '../entities/lesson.entity';
export declare class LessonService extends BaseService<LessonEntity> {
    private readonly lessonRepository;
    constructor(lessonRepository: Repository<LessonEntity>);
    /**
     * Custom Query Example: Fetch lessons inside a module ordered by display position
     */
    findByModuleId(moduleId: string): Promise<LessonEntity[]>;
}
