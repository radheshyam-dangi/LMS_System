import { Injectable } from '@nestjs/common';
import { DocumentEntityService } from '../../services/document.service';

@Injectable()
export class DocumentService{
    constructor(
        private DocumentEntityService : DocumentEntityService
    ){}

}
export {DocumentEntityService}