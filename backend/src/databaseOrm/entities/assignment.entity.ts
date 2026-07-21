import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonEntity } from './lesson.entity';
import { ModuleEntity } from './module.entity';
import { LearningPathEntity } from './learningPath.entity';
import { UserEntity } from './user.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.Assignment)
export class AssignmentEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  // 'Subjective' | 'MCQ'
  @Column({ type: 'varchar', name: 'assignment_type', default: 'Subjective' })
  assignmentType: string;

  // MCQ Options & Correct Answer index JSON structure:
  // e.g., {"options":["Option A","Option B"],"correctIndex":0}
  @Column({ type: 'jsonb', nullable: true })
  mcqConfig: { options: string[]; correctIndex: number };

  @Column({ type: 'integer', name: 'max_score', default: 100 })
  maxScore: number;

  @Column({ type: 'timestamp', name: 'due_date', nullable: true })
  dueDate: Date;

  // 1. Optional attachment to Lesson
  @ManyToOne(() => LessonEntity, (lesson) => lesson.assignments, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Assignment.LessonId })
  lesson?: LessonEntity;

  // 2. Optional direct attachment to Module
  @ManyToOne(() => ModuleEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'moduleId' })
  module?: ModuleEntity;

  // 3. Optional direct attachment to LearningPath
  @ManyToOne(() => LearningPathEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learningPathId' })
  learningPath?: LearningPathEntity;

  // Creator / Trainer reference
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: ForeignKeys.Assignment.CreatedBy })
  createdBy: UserEntity;
}