import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { DocumentEntity } from '../entities/document.entity';
import { DataSource } from 'typeorm/browser';

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