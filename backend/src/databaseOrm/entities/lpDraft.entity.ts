import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity('LpDraft')
export class LpDraftEntity extends BaseEntity {
  @Index()
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: UserEntity;

  @Column({ type: 'uuid', name: 'creator_id' })
  creatorId: string;

  /** Raw Tiptap editor JSON — never parsed until final submit */
  @Column({ type: 'jsonb', name: 'draft_data' })
  draftData: Record<string, any>;

  /** Optional title extracted for display in draft list */
  @Column({ type: 'varchar', nullable: true })
  title: string;

  @Column({
    type: 'varchar',
    default: 'active',
  })
  status: string; // 'active' | 'converted'
}
