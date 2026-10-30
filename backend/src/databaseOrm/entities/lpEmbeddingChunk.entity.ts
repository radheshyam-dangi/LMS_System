import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { LearningPathEntity } from './learningPath.entity';
import { ModuleEntity } from './module.entity';
import { LessonEntity } from './lesson.entity';

/**
 * Dense-vector embedding chunks for LP content.
 * Schema is created now; the embedding column is defined as text[] for compatibility
 * without pgvector. When pgvector is enabled, a migration can alter the type.
 *
 * For V1, this table is populated by the EmbeddingWorkerService using
 * OpenAI text-embedding-3-small (when OPENAI_API_KEY is set).
 * Retrieval falls back to lexical search when this table is empty.
 */
@Entity('lp_embedding_chunks')
@Index('idx_lpec_lp_active', ['learningPathId', 'isActive'])
@Index('idx_lpec_source_key', ['sourceKey', 'chunkIndex'], { unique: true })
export class LpEmbeddingChunkEntity {
  @Column({ type: 'bigint', primary: true, generated: 'increment' })
  id: number;

  @Column({ type: 'uuid', name: 'learning_path_id' })
  learningPathId: string;

  @ManyToOne(() => LearningPathEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learning_path_id' })
  learningPath?: LearningPathEntity;

  @Column({ type: 'uuid', name: 'module_id', nullable: true })
  moduleId?: string | null;

  @ManyToOne(() => ModuleEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'module_id' })
  module?: ModuleEntity | null;

  @Column({ type: 'uuid', name: 'lesson_id', nullable: true })
  lessonId?: string | null;

  @ManyToOne(() => LessonEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'lesson_id' })
  lesson?: LessonEntity | null;

  /**
   * lp_description | module_description | lesson_description |
   * video_transcript | resource | key_point
   */
  @Column({ type: 'varchar', name: 'source_type', length: 50 })
  sourceType: string;

  /** Video URL / resource URL for citation links */
  @Column({ type: 'text', name: 'source_ref', nullable: true })
  sourceRef?: string | null;

  /** Unique key per content piece, e.g. 'lesson:<uuid>:video_transcript' */
  @Column({ type: 'text', name: 'source_key' })
  sourceKey: string;

  @Column({ type: 'integer', name: 'chunk_index' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  /** "LP: X > Module: Y > Lesson: Z" — prepended before embedding for context */
  @Column({ type: 'text', name: 'context_prefix' })
  contextPrefix: string;

  /** SHA-256 of content — used to skip unchanged chunks */
  @Column({ type: 'char', length: 64, name: 'content_hash' })
  contentHash: string;

  @Column({ type: 'integer', name: 'content_version', default: 1 })
  contentVersion: number;

  /**
   * Dense embedding stored as JSONB float array for compatibility without pgvector.
   * On pgvector-enabled Postgres, a migration can alter this to vector(1536).
   */
  @Column({ type: 'jsonb', name: 'embedding', nullable: true })
  embedding?: number[] | null;

  @Column({ type: 'varchar', name: 'embedding_model', length: 100, nullable: true })
  embeddingModel?: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
