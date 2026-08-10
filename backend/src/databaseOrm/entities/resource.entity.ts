import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { LessonEntity } from './lesson.entity';
import { Entities } from '../../constants/entity';

@Entity(Entities.Resource ?? 'Resource')
export class ResourceEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'varchar', nullable: false })
  url: string;

  @Column({ type: 'varchar', nullable: true })
  type: string; // e.g., 'PDF', 'Link', 'Video'

  // 🌟 1. Optional attachment to Module (For Module-level resources)
  @ManyToOne(() => ModuleEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'moduleId' })
  module?: ModuleEntity;

  // 🌟 2. Optional attachment to Lesson
  @ManyToOne(() => LessonEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson?: LessonEntity;
}