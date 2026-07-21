import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AssignmentEntity } from './assignment.entity';
import { UserEntity } from './user.entity';

@Entity('assignment_submissions')
export class AssignmentSubmissionEntity extends BaseEntity {
  @Column({ type: 'text' })
  submissionText: string;

  @Column({ type: 'varchar', nullable: true })
  attachmentUrl: string;

  // 'Submitted' | 'Evaluated'
  @Column({ type: 'varchar', default: 'Submitted' })
  status: string;

  @Column({ type: 'integer', nullable: true })
  score: number;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ type: 'timestamp', name: 'submitted_at', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt: Date;

  @Column({ type: 'timestamp', name: 'evaluated_at', nullable: true })
  evaluatedAt: Date;

  // Target assignment
  @ManyToOne(() => AssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignmentId' })
  assignment: AssignmentEntity;

  // Trainee who submitted
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'traineeId' })
  trainee: UserEntity;

  // Trainer who evaluated/graded
  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'evaluatedById' })
  evaluatedBy?: UserEntity;
}