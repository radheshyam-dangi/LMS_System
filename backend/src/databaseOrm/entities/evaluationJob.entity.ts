import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AssignmentSubmissionEntity } from './assignmentSubmission.entity';
import { AssignmentEntity } from './assignment.entity';

@Entity('EvaluationJob')
export class EvaluationJobEntity extends BaseEntity {
  @ManyToOne(() => AssignmentSubmissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: AssignmentSubmissionEntity;

  @ManyToOne(() => AssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: AssignmentEntity;

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: string;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'integer', name: 'max_attempts', default: 3 })
  maxAttempts: number;

  @Column({ type: 'text', name: 'last_error', nullable: true })
  lastError: string;

  @Column({ type: 'timestamp', name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
  completedAt: Date;
}
