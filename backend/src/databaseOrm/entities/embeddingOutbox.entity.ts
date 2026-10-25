import { Entity, Column, Index } from 'typeorm';

/**
 * Outbox table for async embedding jobs.
 * When a Learning Path or Lesson is saved, we insert a row here.
 * A background worker picks it up and upserts lp_embedding_chunks.
 *
 * Uses the transactional outbox pattern so LP saves are never blocked
 * by embedding API latency.
 */
@Entity('embedding_outbox')
@Index('idx_eo_pending', ['processedAt', 'deadLettered'])
export class EmbeddingOutboxEntity {
  @Column({ type: 'bigint', primary: true, generated: 'increment' })
  id: number;

  /** lp_saved | lesson_saved | lesson_deleted | lp_deleted */
  @Column({ type: 'varchar', name: 'event_type', length: 50 })
  eventType: string;

  /** UUID of the LP or Lesson that changed */
  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'text', name: 'last_error', nullable: true })
  lastError?: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  processedAt?: Date | null;

  @Column({ type: 'boolean', name: 'dead_lettered', default: false })
  deadLettered: boolean;
}
