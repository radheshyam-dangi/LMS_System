import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LearningPathEntity } from './learningPath.entity';
import { UserEntity } from './user.entity';
import { LessonEntity } from './lesson.entity';
import { ResourceEntity } from './resource.entity';

@Entity('Module')
export class ModuleEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => LearningPathEntity, (lp) => lp.modules, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learningPathId' })
  learningPath?: LearningPathEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy?: UserEntity;

  @OneToMany(() => LessonEntity, (lesson) => lesson.module, { cascade: true })
  lessons: LessonEntity[];

  // 🌟 Add Resources relation directly on Module
  @OneToMany(() => ResourceEntity, (resource) => resource.module, { cascade: true })
  resources: ResourceEntity[];
}