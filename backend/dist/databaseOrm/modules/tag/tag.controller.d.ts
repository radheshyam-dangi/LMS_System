import { TagService } from './tag.service';
import type { TagModel } from '../../../types/models/tag.model';
export declare class TagController {
    private readonly tagService;
    constructor(tagService: TagService);
    create(dto: TagModel): Promise<import("../../entities/tag.entity").TagEntity>;
    findAll(): Promise<import("../../entities/tag.entity").TagEntity[]>;
    findOne(id: string): Promise<import("../../entities/tag.entity").TagEntity | null>;
    update(id: string, dto: Partial<TagModel>): Promise<import("../../entities/tag.entity").TagEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
