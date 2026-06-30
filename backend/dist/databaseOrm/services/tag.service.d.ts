import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { TagEntity } from '../entities/tag.entity';
export declare class TagService extends BaseService<TagEntity> {
    private readonly tagRepository;
    constructor(tagRepository: Repository<TagEntity>);
}
