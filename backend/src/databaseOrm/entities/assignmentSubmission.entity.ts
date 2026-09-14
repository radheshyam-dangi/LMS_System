import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AssignmentEntity } from './assignment.entity';
import { UserEntity } from './user.entity';

@Entity('AssignmentSubmission')
export class AssignmentSubmissionEntity extends BaseEntity {
  // 🌟 1. Text content submitted by the trainee
  @Column({ type: 'text', name: 'submission_text', nullable: true })
  submissionText: string;

  @Column({ type: 'varchar', name: 'attachment_url', nullable: true })
  attachmentUrl: string;

  // 🌟 3. Status tracking
  @Index()
  @Column({ 
    type: 'varchar',
    default: 'LOCKED' 
  })
  status: string;

  // 🌟 4. Evaluation feedback and grade score
  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Index()
  @Column({ type: 'integer', nullable: true })
  score: number;

  @Column({ type: 'timestamp', name: 'submitted_at', nullable: true })
  submittedAt: Date;

  @Column({ type: 'timestamp', name: 'lp_assigned_at', nullable: true })
  lpAssignedAt: Date | null;

  @Column({ type: 'timestamp', name: 'task_unlocked_at', nullable: true })
  taskUnlockedAt: Date | null;

  @Column({ type: 'timestamp', name: 'deadline', nullable: true })
  deadline: Date | null;

  @Column({ type: 'timestamp', name: 'timer_started_at', nullable: true })
  timerStartedAt: Date | null;

  @Column({ type: 'timestamp', name: 'evaluated_at', nullable: true })
  evaluatedAt: Date | null;

  // 🌟 5. ManyToOne Relation pointing to AssignmentEntity
  @ManyToOne(() => AssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: AssignmentEntity;

  // 🌟 6. Trainee User reference
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainee_id' })
  trainee: UserEntity;

  // 🌟 7. Evaluator/Trainer User reference
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'evaluated_by_id' })
  evaluatedBy: UserEntity;

  // ────────────────────────────────────────────
  // 🌟 AI Evaluation Pipeline Fields
  // ────────────────────────────────────────────

  /** Structured answers: [{ questionId, answer }] */
  @Column({ type: 'jsonb', nullable: true })
  answers: Array<{ questionId: string; answer: string }>;

  /** How was this submission evaluated? 'manual' | 'ai_assisted' | 'ai_auto' */
  @Column({
    type: 'varchar',
    name: 'evaluation_method',
    nullable: true,
  })
  evaluationMethod: string;

  /**
   * Raw AI evaluation response stored for audit trail.
   * Shape: { questionScores: [...], totalScore, totalMaxScore, overallRemark }
   */
  @Column({
    type: 'jsonb',
    name: 'ai_evaluation_result',
    nullable: true,
  })
  aiEvaluationResult: Record<string, any>;

  /** True if some dependent lesson content was unavailable during AI evaluation */
  @Column({
    type: 'boolean',
    name: 'context_incomplete',
    default: false,
  })
  contextIncomplete: boolean;

  /**
   * AI evaluation pipeline status:
   * null — not AI-evaluated
   * 'pending' — queued for evaluation
   * 'ai_evaluated_pending_review' — AI done, awaiting trainer review
   * 'ai_auto_released' — AI result auto-released to trainee
   * 'ai_evaluation_failed' — AI evaluation failed, routed to manual
   */
  @Column({
    type: 'varchar',
    name: 'ai_evaluation_status',
    nullable: true,
  })
  aiEvaluationStatus: string;
}
