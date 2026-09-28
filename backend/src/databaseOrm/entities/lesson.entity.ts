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
  description: string | null;

  @Column({ type: 'varchar', name: 'video_url', nullable: true })
  videoUrl: string | null;

  @Column({ type: 'varchar', name: 'article_url', nullable: true })
  articleUrl: string | null;

  @Column({
    type: 'integer',
    name: 'duration_minutes',
    nullable: true,
    default: 15,
  })
  durationMinutes: number;

  @Column({
    type: 'integer',
    name: 'display_order',
    nullable: true,
    default: 1,
  })
  displayOrder: number;

  @Column({ type: 'integer', name: 'content_version', default: 1 })
  contentVersion: number;

  @Column({ type: 'varchar', name: 'source_hash', nullable: true })
  sourceHash: string;

  // ────────────────────────────────────────────
  // 🌟 Tiptap Authoring: Multi-media content blocks
  // ────────────────────────────────────────────

  /** Multiple video blocks: [{ url, title? }] */
  @Column({ type: 'jsonb', nullable: true, default: [] })
  videos: Array<{ url: string; title?: string }>;

  /** Multiple audio blocks: [{ url, title? }] */
  @Column({ type: 'jsonb', nullable: true, default: [] })
  audios: Array<{ url: string; title?: string }>;

  /** Key points / bullet list items */
  @Column({ type: 'jsonb', name: 'key_points', nullable: true, default: [] })
  keyPoints: string[];

  @ManyToOne(() => ModuleEntity, (module) => module.lessons, {
    nullable: true,
    onDelete: 'CASCADE',
  })
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
