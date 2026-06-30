import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { DocumentEntity } from './document.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.DocumentAssociation)
export class DocumentAssociationEntity extends BaseEntity {
  @Column({ type: 'varchar', name: 'associationType', nullable: false })
  associationType: string;

  @Column({ type: 'uuid', name: ForeignKeys.DocumentAssociation.AssociationId, nullable: false })
  associationId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'integer', name: 'refCount', default: 1 })
  refCount: number;

  @ManyToOne(() => DocumentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.DocumentAssociation.DocumentId })
  document: DocumentEntity;
}