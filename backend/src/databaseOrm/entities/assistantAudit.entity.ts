import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('assistant_audit')
@Index('idx_assistant_audit_user_created', ['userId', 'createdAt'])
export class AssistantAuditEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  role: string;

  @Column({ type: 'varchar', length: 64 })
  intent: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'varchar', length: 64, name: 'action_type', nullable: true })
  actionType: string | null;

  @Column({ type: 'uuid', name: 'target_id', nullable: true })
  targetId: string | null;

  @Column({ type: 'varchar', length: 32, default: 'success' })
  outcome: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}
