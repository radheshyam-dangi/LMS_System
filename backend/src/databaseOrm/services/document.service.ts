import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { DocumentEntity } from '../entities/document.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class DocumentEntityService extends BaseService<DocumentEntity> {
  protected repository: Repository<DocumentEntity>;
  constructor(
    datasource:DataSource
  ) {
    super();
    this.repository=datasource.getRepository<DocumentEntity>(DocumentEntity)
  }
}