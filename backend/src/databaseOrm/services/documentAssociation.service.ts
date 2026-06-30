import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { DocumentAssociationEntity } from '../entities/documentAssociation.entity';

@Injectable()
export class DocumentAssociationService extends BaseService<DocumentAssociationEntity> {
  constructor(
    @InjectRepository(DocumentAssociationEntity)
    private readonly documentAssociationRepository: Repository<DocumentAssociationEntity>,
  ) {
    super(documentAssociationRepository);
  }
}