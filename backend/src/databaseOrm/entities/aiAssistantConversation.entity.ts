import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { AiAssistantMessageEntity } from './aiAssistantMessage.entity';

/**
 * Stores one conversation thread for the Global AI Assistant.
 * Scoped to a single trainee — trainee can only see their own conversations.
 */
@Entity('ai_assistant_conversations')
@Index('idx_aac_trainee_id', ['traineeId'])
export class AiAssistantConversationEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'trainee_id' })
  @Index()
  traineeId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainee_id' })
  trainee: UserEntity;

  /** Auto-generated title from first message (first 80 chars) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string | null;

  /** Total message count for quick display without loading messages */
  @Column({ type: 'integer', name: 'message_count', default: 0 })
  messageCount: number;

  @OneToMany(() => AiAssistantMessageEntity, (msg) => msg.conversation, {
    cascade: false,
  })
  messages: AiAssistantMessageEntity[];
}
