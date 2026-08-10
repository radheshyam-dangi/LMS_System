import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Entities } from '../../constants/entity';

// 🌟 FIX 1: Import the concrete entity for TypeORM metadata resolution
import { ModuleTagEntity } from './moduleTag.entity'; 

// 🌟 FIX 2: Use 'import type' for the strict TS compiler declaration array pass
import type { ModuleTagEntity as ModuleTagEntityType } from './moduleTag.entity';

@Entity(Entities.Tag)
export class TagEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true, nullable: false })
  name: string;

  // 🌟 FIX 3: TypeORM reads the first argument at runtime, TS reads the second as a pure type
  @OneToMany(() => ModuleTagEntity, (moduleTag) => moduleTag.tag, { onDelete: 'CASCADE' })
  moduleTags: ModuleTagEntityType[];
}