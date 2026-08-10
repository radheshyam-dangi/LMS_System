import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { LearningPathEntity } from './learningPath.entity';
import { AssignmentEntity } from './assignment.entity';
import { UserLessonProgressEntity } from './userLessonProgress.entity';
import { UserEntity } from './user.entity';
import { ResourceEntity } from './resource.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.Lesson)
export class LessonEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', name: 'video_url', nullable: true })
  videoUrl: string;

  @Column({ type: 'varchar', name: 'article_url', nullable: true })
  articleUrl: string;

  @Column({ type: 'integer', name: 'duration_minutes', nullable: true, default: 15 })
  durationMinutes: number;

  @Column({ type: 'integer', name: 'display_order', nullable: true, default: 1 })
  displayOrder: number;

  @ManyToOne(() => ModuleEntity, (module) => module.lessons, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Lesson.ModuleId })
  module?: ModuleEntity;

  @ManyToOne(() => LearningPathEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learningPathId' })
  learningPath?: LearningPathEntity;

  // 🌟 ADDED: CreatedBy relation to track ownership & trainer permissions
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy?: UserEntity;

  // Primary Assignment relation with automatic cascading cleanup
  @OneToMany(() => AssignmentEntity, (assignment) => assignment.lesson, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  assignments: AssignmentEntity[];

  // 🌟 Alias for backward compatibility
  @OneToMany(() => AssignmentEntity, (assignment) => assignment.lesson, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  tasks: AssignmentEntity[];

  @OneToMany(() => UserLessonProgressEntity, (progress) => progress.lesson, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  progressRecords: UserLessonProgressEntity[];

  @OneToMany(() => ResourceEntity, (resource) => resource.lesson, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  resources: ResourceEntity[];
}