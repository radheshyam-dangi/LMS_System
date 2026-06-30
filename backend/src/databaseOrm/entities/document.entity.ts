import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Entities } from '../../constants/entity';

@Entity(Entities.Document)
export class DocumentEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true, nullable: false })
  identifier: string;

  @Column({ type: 'varchar', name: 'mimeType', nullable: false })
  mimeType: string;

  @Column({ type: 'varchar', name: 'documentName', nullable: false })
  documentName: string;

  @Column({ type: 'varchar', name: 'originalDocumentName', nullable: false })
  originalDocumentName: string;

  @Column({ type: 'text', name: 'documentUrl', nullable: false })
  documentUrl: string;

  @Column({ type: 'varchar', nullable: false })
  extension: string;

  @Column({ type: 'varchar', nullable: false })
  encoding: string;

  @Column({ type: 'bigint', name: 'sizeBytes', default: 0 })
  sizeBytes: number;

  @Column({ type: 'integer', name: 'uploadCount', default: 1 })
  uploadCount: number;
}