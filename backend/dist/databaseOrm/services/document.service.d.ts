import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { DocumentEntity } from '../entities/document.entity';
export declare class DocumentService extends BaseService<DocumentEntity> {
    private readonly documentRepository;
    constructor(documentRepository: Repository<DocumentEntity>);
}
