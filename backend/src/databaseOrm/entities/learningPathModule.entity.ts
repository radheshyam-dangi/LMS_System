import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LearningPathEntity } from './learningPath.entity';
import { ModuleEntity } from './module.entity';
import { ForeignKeys } from '../../constants/foreignKeys';
import { Entities } from '../../constants/entity';

@Entity(Entities.LearningPathModule)
export class LearningPathModuleEntity extends BaseEntity {
  @Column({ type: 'integer', name: 'displayOrder', default: 0 })
  displayOrder: number;

  // Relationships
  @ManyToOne(() => LearningPathEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.LearningPathModule.LearningPathId })
  learningPath: LearningPathEntity;

  @ManyToOne(() => ModuleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.LearningPathModule.ModuleId })
  module: ModuleEntity;
}