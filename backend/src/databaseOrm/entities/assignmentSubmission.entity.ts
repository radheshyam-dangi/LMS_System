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

  @Column({ type: 'varchar', default: 'Submitted' })
  status: string;

  @Column({ type: 'integer', nullable: true })
  score: number;

  @ManyToOne(() => AssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignmentId' })
  assignment: AssignmentEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'traineeId' })
  trainee: UserEntity;
}