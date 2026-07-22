import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AssignmentEntity } from './assignment.entity';
import { UserEntity } from './user.entity';

@Entity('AssignmentSubmission')
export class AssignmentSubmissionEntity extends BaseEntity {
  // 🌟 1. Text content submitted by the trainee
  @Column({ type: 'text', name: 'submission_text', nullable: true })
  submissionText: string;

  // 🌟 2. Optional uploaded attachment or link
  @Column({ type: 'varchar', name: 'attachment_url', nullable: true })
  attachmentUrl: string;

  // 🌟 3. Status tracking (Submitted, Evaluated, Pending, etc.)
  @Column({ type: 'varchar', default: 'Submitted' })
  status: string;

  // 🌟 4. Evaluation feedback and grade score
  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ type: 'integer', nullable: true })
  score: number;

  @Column({ type: 'timestamp', name: 'submitted_at', nullable: true })
  submittedAt: Date;

  @Column({ type: 'timestamp', name: 'evaluated_at', nullable: true })
  evaluatedAt: Date;

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
}