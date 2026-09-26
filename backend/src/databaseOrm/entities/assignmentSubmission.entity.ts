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
  // 🌟 AI Evaluation Pipeline Fields (From Spec)
  // ────────────────────────────────────────────

  /** Structured answers from Tiptap submission */
  @Column({ type: 'jsonb', nullable: true })
  answers: any;

  @Column({ type: 'jsonb', name: 'ai_question_scores', nullable: true })
  aiQuestionScores: any;

  @Column({ type: 'numeric', name: 'ai_total_score', nullable: true })
  aiTotalScore: number;

  @Column({ type: 'numeric', name: 'ai_total_max_score', nullable: true })
  aiTotalMaxScore: number;

  @Column({ type: 'text', name: 'ai_overall_remark', nullable: true })
  aiOverallRemark: string;

  @Column({ type: 'boolean', name: 'ai_context_incomplete', default: false })
  aiContextIncomplete: boolean;

  @Column({ type: 'boolean', name: 'ai_evaluation_error', default: false })
  aiEvaluationError: boolean;

  @Column({ type: 'jsonb', name: 'question_scores', nullable: true })
  questionScores: any;

  @Column({ type: 'numeric', name: 'total_score', nullable: true })
  totalScore: number;

  @Column({ type: 'numeric', name: 'total_max_score', nullable: true })
  totalMaxScore: number;

  @Column({ type: 'text', name: 'overall_remark', nullable: true })
  overallRemark: string;

  /** How was this submission evaluated? 'manual' | 'ai_assisted' | 'ai_auto' */
  @Column({
    type: 'varchar',
    name: 'evaluation_method',
    nullable: true,
  })
  evaluationMethod: string;
}
