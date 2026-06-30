import { Injectable } from '@nestjs/common';
import { DocumentService as MainDocumentService } from '../../services/document.service';

@Injectable()
export class DocumentService extends MainDocumentService {}