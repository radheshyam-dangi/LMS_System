import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { LearningPathEntity } from './learningPath.entity';
import { LessonEntity } from './lesson.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.Module)
export class ModuleEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', name: 'difficulty_level', nullable: true, default: 'Intermediate' })
  difficultyLevel: string;

  @Column({ type: 'varchar', nullable: true, default: 'Active' })
  status: string;

  // Self-referencing Parent/Child Submodule Relationship
  @ManyToOne(() => ModuleEntity, (module) => module.subModules, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Module.ParentId || 'parentId' })
  parent?: ModuleEntity;

  @OneToMany(() => ModuleEntity, (module) => module.parent)
  subModules: ModuleEntity[];

  // Direct LearningPath reference
  @ManyToOne(() => LearningPathEntity, (lp) => lp.modules, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'learningPathId' })
  learningPath?: LearningPathEntity;

  // Creator User Reference
  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: ForeignKeys.Module.CreatedBy || 'createdBy' })
  createdBy?: UserEntity;

  // Lessons within Module
  @OneToMany(() => LessonEntity, (lesson) => lesson.module, { cascade: true })
  lessons: LessonEntity[];
}