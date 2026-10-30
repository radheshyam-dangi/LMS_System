import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TrainerAiConversationEntity } from './trainerAiConversation.entity';

@Entity('trainer_ai_messages')
@Index('idx_tam_conversation_id', ['conversationId'])
export class TrainerAiMessageEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'conversation_id' })
  @Index()
  conversationId: string;

  @ManyToOne(() => TrainerAiConversationEntity, (conv) => conv.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: TrainerAiConversationEntity;

  @Column({ type: 'varchar', length: 20 })
  role: 'user' | 'assistant' | 'system';

  @Column({ type: 'text' })
  content: string;

  /**
   * Action card payload for interactive preview & confirm
   * e.g. {
   *   actionId: 'uuid',
   *   type: 'create_lp',
   *   lpId: 'uuid',
   *   lpTitle: '...',
   *   moduleCount: 3,
   *   lessonCount: 6,
   *   assignmentCount: 3,
   *   status: 'pending' | 'confirmed' | 'cancelled' | 'expired'
   * }
   */
  @Column({ type: 'jsonb', nullable: true, name: 'action_card' })
  actionCard?: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, name: 'source_label', nullable: true })
  sourceLabel?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  citations?: any[] | null;

  @Column({ type: 'varchar', length: 20, name: 'feedback', nullable: true })
  feedback?: string | null;

  @Column({ type: 'text', name: 'feedback_comment', nullable: true })
  feedbackComment?: string | null;
}
