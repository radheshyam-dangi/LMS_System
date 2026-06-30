import { BaseEntity } from './base.entity';
export declare class DocumentEntity extends BaseEntity {
    identifier: string;
    mimeType: string;
    documentName: string;
    originalDocumentName: string;
    documentUrl: string;
    extension: string;
    encoding: string;
    sizeBytes: number;
    uploadCount: number;
}
