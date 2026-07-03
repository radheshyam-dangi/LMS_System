import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { DocumentEntity } from '../entities/document.entity';
import { DataSource } from 'typeorm';
export declare class DocumentEntityService extends BaseService<DocumentEntity> {
    protected repository: Repository<DocumentEntity>;
    constructor(datasource: DataSource);
}
