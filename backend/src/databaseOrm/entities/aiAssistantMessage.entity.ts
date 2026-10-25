import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AiAssistantConversationEntity } from './aiAssistantConversation.entity';

/**
 * Single message in a Global AI Assistant conversation.
 * Citations are stored as JSONB so we can render them without a separate fetch.
 */
@Entity('ai_assistant_messages')
@Index('idx_aam_conversation_id', ['conversationId'])
export class AiAssistantMessageEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'conversation_id' })
  @Index()
  conversationId: string;

  @ManyToOne(() => AiAssistantConversationEntity, (conv) => conv.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: AiAssistantConversationEntity;

  /** 'user' | 'assistant' | 'system' */
  @Column({ type: 'varchar', length: 20 })
  role: string;

  /** The raw message text */
  @Column({ type: 'text' })
  content: string;

  /**
   * Source label for the answer: 'lp_content' | 'web' | 'none'
   * Only meaningful on 'assistant' role messages.
   */
  @Column({ type: 'varchar', length: 20, name: 'source_label', nullable: true })
  sourceLabel?: string | null;

  /**
   * Citations for the answer.
   * For LP content: [{ lessonId, lessonTitle, lpTitle, chunkPreview }]
   * For web: [{ url, title }]
   */
  @Column({ type: 'jsonb', nullable: true })
  citations?: any[] | null;

  /** Token count for cost monitoring */
  @Column({ type: 'integer', name: 'token_count', nullable: true })
  tokenCount?: number | null;

  /** Latency in ms for debugging */
  @Column({ type: 'integer', name: 'latency_ms', nullable: true })
  latencyMs?: number | null;

  /** thumbs_up | thumbs_down | null */
  @Column({ type: 'varchar', length: 20, name: 'feedback', nullable: true })
  feedback?: string | null;

  @Column({ type: 'text', name: 'feedback_comment', nullable: true })
  feedbackComment?: string | null;
}
