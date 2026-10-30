import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { TrainerAiMessageEntity } from './trainerAiMessage.entity';

@Entity('trainer_ai_conversations')
@Index('idx_tac_trainer_id', ['trainerId'])
export class TrainerAiConversationEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'trainer_id' })
  @Index()
  trainerId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainer_id' })
  trainer: UserEntity;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string | null;

  @Column({ type: 'integer', name: 'message_count', default: 0 })
  messageCount: number;

  @OneToMany(() => TrainerAiMessageEntity, (msg) => msg.conversation, {
    cascade: false,
  })
  messages: TrainerAiMessageEntity[];
}
