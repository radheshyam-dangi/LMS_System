import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { LearningPathEntity } from './learningPath.entity'; // 👈 Import LearningPathEntity
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

  // Relation: Optional Module attachment
  @ManyToOne(() => ModuleEntity, (module) => module.lessons, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Lesson.ModuleId })
  module?: ModuleEntity;

  // 🌟 FIX: Add direct relationship to LearningPathEntity
  @ManyToOne(() => LearningPathEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learningPathId' })
  learningPath?: LearningPathEntity;

  // Relation: One Lesson has many Assignments
  @OneToMany(() => AssignmentEntity, (assignment) => assignment.lesson, { cascade: true })
  assignments: AssignmentEntity[];

  // Relation: Progress records
  @OneToMany(() => UserLessonProgressEntity, (progress) => progress.lesson)
  progressRecords: UserLessonProgressEntity[];
}