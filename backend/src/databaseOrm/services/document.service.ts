import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { DocumentEntity } from '../entities/document.entity';

@Injectable()
export class DocumentService extends BaseService<DocumentEntity> {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
  ) {
    super(documentRepository);
  }
}