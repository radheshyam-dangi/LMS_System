import { DocumentService } from './document.service';
import type { DocumentModel } from '../../../types/models/document.model';
export declare class DocumentController {
    private readonly documentService;
    constructor(documentService: DocumentService);
    create(dto: DocumentModel): Promise<import("../../entities/document.entity").DocumentEntity>;
    findAll(): Promise<import("../../entities/document.entity").DocumentEntity[]>;
    findOne(id: string): Promise<import("../../entities/document.entity").DocumentEntity | null>;
    update(id: string, dto: Partial<DocumentModel>): Promise<import("../../entities/document.entity").DocumentEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
