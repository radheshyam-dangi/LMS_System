import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { SubmissionEntity } from './submission.entity';

@Entity('ai_feedback')
export class AiFeedbackEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'submission_id' })
  submissionId: string;

  @ManyToOne(() => SubmissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: SubmissionEntity;

  @Column({ type: 'text', name: 'generated_feedback', nullable: true })
  generatedFeedback: string;

  @Column({ type: 'text', name: 'architecture_review', nullable: true })
  architectureReview: string;

  @Column({ type: 'text', name: 'improvement_suggestions', nullable: true })
  improvementSuggestions: string;
}
