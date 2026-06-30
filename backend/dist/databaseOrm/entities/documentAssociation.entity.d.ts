import { BaseEntity } from './base.entity';
import { DocumentEntity } from './document.entity';
export declare class DocumentAssociationEntity extends BaseEntity {
    associationType: string;
    associationId: string;
    description: string;
    refCount: number;
    document: DocumentEntity;
}
