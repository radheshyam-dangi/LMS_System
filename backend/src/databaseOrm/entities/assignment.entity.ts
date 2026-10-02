import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
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
  @Index()
  @Column({ type: 'varchar', name: 'assignment_type', default: 'Subjective' })
  assignmentType: string;

  @Index()
  @Column({
    type: 'varchar',
    name: 'difficulty_level',
    nullable: true,
    default: 'Intermediate',
  })
  difficultyLevel: string;

  // MCQ Options & Correct Answer index JSON structure:
  // e.g., {"options":["Option A","Option B"],"correctIndex":0}
  @Column({ type: 'jsonb', nullable: true })
  mcqConfig: { options: string[]; correctIndex: number };

  @Column({ type: 'integer', name: 'max_score', default: 100 })
  maxScore: number;

  @Column({ type: 'integer', name: 'timer_duration', default: 0 })
  timerDuration: number;

  @Column({ type: 'integer', name: 'duration_days', default: 0 })
  durationDays: number;

  @Column({ type: 'integer', name: 'duration_hours', default: 0 })
  durationHours: number;

  @Column({ type: 'integer', name: 'duration_minutes', default: 0 })
  durationMinutes: number;

  @Column({ type: 'varchar', name: 'anchor_type', default: 'LP_ASSIGNED' })
  anchorType: string;

  @Column({ type: 'integer', name: 'sequence_index', nullable: true })
  sequenceIndex: number | null;

  @Column({ type: 'boolean', name: 'is_external', default: false })
  isExternal: boolean;

  // Dynamically injected by service
  assignedBy?: any;

  // 1. Optional attachment to Lesson
  @ManyToOne(() => LessonEntity, (lesson) => lesson.assignments, {
    nullable: true,
    onDelete: 'CASCADE',
  })
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

  @Column({ nullable: true })
  externalUrl: string;

  /** Trainee UUIDs for external / direct assignments (no learning path required) */
  @Column({
    type: 'jsonb',
    name: 'assigned_to_trainee_ids',
    nullable: true,
    default: [],
  })
  assignedToTraineeIds: string[];

  // ────────────────────────────────────────────
  // 🌟 Tiptap Authoring: Lock & AI Toggles
  // ────────────────────────────────────────────

  /** If true, assignment stays non-clickable until ALL preceding lessons are completed */
  @Column({
    type: 'boolean',
    name: 'lock_until_lessons_complete',
    default: true,
  })
  lockUntilLessonsComplete: boolean;

  /** If true, submission goes through Groq AI evaluation pipeline */
  @Column({
    type: 'boolean',
    name: 'auto_evaluate_with_ai',
    default: false,
  })
  autoEvaluateWithAI: boolean;

  /**
   * Only relevant when autoEvaluateWithAI = true.
   * If true, AI result is a draft pending trainer review.
   * If false, AI result is auto-released immediately.
   */
  @Column({
    type: 'boolean',
    name: 'human_intervention_required',
    default: true,
  })
  humanInterventionRequired: boolean;

  /**
   * For external assignment type: when does the countdown timer start?
   * 'onAssignment' = when the LP/assignment is assigned to trainee
   * 'onTraineeStart' = when the trainee explicitly starts the assignment
   */
  @Column({
    type: 'varchar',
    name: 'countdown_start',
    nullable: true,
    default: 'onAssignment',
  })
  countdownStart: string;

  /**
   * Structured questions array:
   * [{ id, text, type: 'MCQ'|'Subjective', maxPoints, options?: string[], correctIndex?: number }]
   */
  @Column({
    type: 'jsonb',
    nullable: true,
    default: null,
  })
  questions: Array<{
    id: string;
    text: string;
    type: 'MCQ' | 'Subjective';
    maxPoints: number;
    options?: string[];
    correctIndex?: number;
    expectedAnswerGuideline?: string;
    requiresLessonGrounding?: boolean;
  }>;

  /**
   * UUIDs of lessons this assignment DEPENDS ON.
   * Populated from authoring order — all lessons preceding this assignment
   * in the same module are dependencies.
   */
  @Column({
    type: 'jsonb',
    name: 'depends_on_lesson_ids',
    nullable: true,
    default: [],
  })
  dependsOnLessonIds: string[];
}
