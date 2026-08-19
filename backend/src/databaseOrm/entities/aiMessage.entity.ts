import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AiConversationEntity } from './aiConversation.entity';

@Entity('ai_messages')
export class AiMessageEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => AiConversationEntity, (conv) => conv.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: AiConversationEntity;

  @Column({ type: 'varchar', length: 50 })
  role: 'system' | 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;
}
