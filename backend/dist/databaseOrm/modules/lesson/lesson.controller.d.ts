import { LessonEntityService } from './lesson.service';
import type { LessonModel } from '../../../types/models/lesson.model';
export declare class LessonController {
    private readonly lessonService;
    constructor(lessonService: LessonEntityService);
    create(dto: LessonModel): Promise<import("../../entities/lesson.entity").LessonEntity>;
    findAll(): Promise<import("../../entities/lesson.entity").LessonEntity[]>;
    findOne(id: string): Promise<import("../../entities/lesson.entity").LessonEntity | null>;
    update(id: string, dto: Partial<LessonModel>): Promise<import("../../entities/lesson.entity").LessonEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
