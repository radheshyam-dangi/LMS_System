import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { AssignmentEntity } from './assignment.entity';
import { UserLessonProgressEntity } from './userLessonProgress.entity';
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

  // Relation: Lesson belongs to a Module
  @ManyToOne(() => ModuleEntity, (module) => module.lessons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Lesson.ModuleId })
  module: ModuleEntity;

  // Relation: One Lesson has many Assignments
  @OneToMany(() => AssignmentEntity, (assignment) => assignment.lesson, { cascade: true })
  assignments: AssignmentEntity[];

  // Relation: One Lesson tracks progress across users
  @OneToMany(() => UserLessonProgressEntity, (progress) => progress.lesson)
  progressRecords: UserLessonProgressEntity[];
}