import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { SubmissionEntity } from './submission.entity';
import { UserEntity } from './user.entity';
import { ForeignKeys } from '../../constants/foreignKeys';
import { Entities } from '../../constants/entity';

@Entity(Entities.Evaluation)
export class EvaluationEntity extends BaseEntity {
  @Column({ type: 'integer', name: 'technicalScore', default: 0 })
  technicalScore: number;

  @Column({ type: 'integer', name: 'architectureScore', default: 0 })
  architectureScore: number;

  @Column({ type: 'integer', name: 'problemSolvingScore', default: 0 })
  problemSolvingScore: number;

  @Column({ type: 'integer', name: 'documentationScore', default: 0 })
  documentationScore: number;

  @Column({ type: 'integer', name: 'overallScore', default: 0 })
  overallScore: number;

  @Column({ type: 'text', nullable: false })
  feedback: string;

  @ManyToOne(() => SubmissionEntity, (submission) => submission.evaluations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Evaluation.SubmissionId })
  submission: SubmissionEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: ForeignKeys.Evaluation.EvaluatorId })
  evaluator: UserEntity;
}