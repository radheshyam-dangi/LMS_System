import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AssignmentEntity } from './assignment.entity';
import { UserEntity } from './user.entity';
import { EvaluationEntity } from './evaluation.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';
@Entity(Entities.Submission)
export class SubmissionEntity extends BaseEntity {
  @Column({ type: 'varchar', name: 'submissionType', nullable: false })
  submissionType: string;

  @Column({ type: 'text', name: 'githubUrl', nullable: true })
  githubUrl: string;

  @Column({ type: 'text', name: 'liveUrl', nullable: true })
  liveUrl: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: string;

  @Column({ type: 'timestamp', name: 'submittedAt', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt: Date;

  @ManyToOne(() => AssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Submission.AssignmentId })
  assignment: AssignmentEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Submission.UserId })
  user: UserEntity;

  @OneToMany(() => EvaluationEntity, (evaluation) => evaluation.submission)
  evaluations: EvaluationEntity[];
}