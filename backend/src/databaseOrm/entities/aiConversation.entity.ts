import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { AiMessageEntity } from './aiMessage.entity';

@Entity('ai_conversations')
export class AiConversationEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @OneToMany(() => AiMessageEntity, (message) => message.conversation)
  messages: AiMessageEntity[];
}
