import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { DocumentAssociationEntity } from '../entities/documentAssociation.entity';
import { DataSource } from 'typeorm/browser';
export declare class DocumentAssociationEntityService extends BaseService<DocumentAssociationEntity> {
    protected repository: Repository<DocumentAssociationEntity>;
    constructor(datasource: DataSource);
}
