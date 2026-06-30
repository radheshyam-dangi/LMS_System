import { BaseModel } from './base.model';
export interface DocumentModel extends BaseModel {
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
