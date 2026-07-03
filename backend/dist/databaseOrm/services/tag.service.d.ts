import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { TagEntity } from '../entities/tag.entity';
export declare class TagEntityService extends BaseService<TagEntity> {
    protected repository: Repository<TagEntity>;
    constructor(datasource: DataSource);
}
