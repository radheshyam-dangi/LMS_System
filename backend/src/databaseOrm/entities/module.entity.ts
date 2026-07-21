import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LearningPathEntity } from './learningPath.entity';
import { UserEntity } from './user.entity';
import { LessonEntity } from './lesson.entity';

@Entity('Module')
export class ModuleEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // 🌟 FIX: Add nullable: true to prevent FK sync failures on existing rows
  @ManyToOne(() => LearningPathEntity, (lp) => lp.modules, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learningPathId' })
  learningPath?: LearningPathEntity;

  // 🌟 FIX: Add nullable: true here as well
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy?: UserEntity;

  @OneToMany(() => LessonEntity, (lesson) => lesson.module, { cascade: true })
  lessons: LessonEntity[];
}