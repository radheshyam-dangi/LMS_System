import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

export type AssistantActionStatus = 'pending' | 'executed' | 'cancelled' | 'expired';

@Entity('assistant_actions')
@Index('idx_assistant_actions_trainer_status', ['trainerId', 'status'])
export class AssistantActionEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'trainer_id' })
  @Index()
  trainerId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainer_id' })
  trainer: UserEntity;

  @Column({ type: 'varchar', length: 64, name: 'action_type' })
  actionType: string; // e.g. 'confirm_create'

  @Column({ type: 'uuid', name: 'target_id', nullable: true })
  targetId: string | null; // e.g. learning_path id

  @Column({
    type: 'varchar',
    length: 32,
    default: 'pending',
  })
  status: AssistantActionStatus;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @Column({ type: 'varchar', length: 128, name: 'idempotency_key', nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;
}
