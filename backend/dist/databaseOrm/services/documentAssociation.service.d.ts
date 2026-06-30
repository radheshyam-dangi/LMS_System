import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { DocumentAssociationEntity } from '../entities/documentAssociation.entity';
export declare class DocumentAssociationService extends BaseService<DocumentAssociationEntity> {
    private readonly documentAssociationRepository;
    constructor(documentAssociationRepository: Repository<DocumentAssociationEntity>);
}
