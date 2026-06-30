import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.ModulePrerequisite)
export class ModulePrerequisiteEntity extends BaseEntity {
  @ManyToOne(() => ModuleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.ModulePrerequisite.PrerequisiteModuleId })
  module: ModuleEntity;

  @ManyToOne(() => ModuleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.ModulePrerequisite.ModuleId })
  prerequisiteModule: ModuleEntity;
}