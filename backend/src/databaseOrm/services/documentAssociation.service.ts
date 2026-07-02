import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { DocumentAssociationEntity } from '../entities/documentAssociation.entity';
import { DataSource } from 'typeorm/browser';

@Injectable()
export class DocumentAssociationEntityService extends BaseService<DocumentAssociationEntity> {
  protected repository: Repository<DocumentAssociationEntity>;
  constructor(
      datasource:DataSource

  ) {
    super();
    this.repository = datasource.getRepository<DocumentAssociationEntity>(DocumentAssociationEntity)
  }
}