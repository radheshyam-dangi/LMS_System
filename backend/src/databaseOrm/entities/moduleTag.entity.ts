import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { TagEntity } from './tag.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';
@Entity(Entities.ModuleTag)
export class ModuleTagEntity extends BaseEntity {
  @ManyToOne(() => ModuleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.ModuleTag.ModuleId })
  module: ModuleEntity;

  @ManyToOne(() => TagEntity, (tag) => tag.moduleTags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.ModuleTag.TagId })
  tag: TagEntity;
}