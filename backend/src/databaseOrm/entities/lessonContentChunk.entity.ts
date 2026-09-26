import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonEntity } from './lesson.entity';

@Entity('LessonContentChunk')
@Index('idx_lcc_lesson_version', ['lesson', 'contentVersion'])
export class LessonContentChunkEntity extends BaseEntity {
  @ManyToOne(() => LessonEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: LessonEntity;

  @Column({ type: 'integer', name: 'content_version', nullable: false })
  contentVersion: number;

  @Column({ type: 'integer', name: 'chunk_index', nullable: false })
  chunkIndex: number;

  @Column({ type: 'text', name: 'chunk_text', nullable: false })
  chunkText: string;

  // TypeORM doesn't natively support GENERATED ALWAYS AS tsvector in a simple way without raw queries,
  // but we can define the column and use migrations or a trigger, or just store the tsvector type.
  @Column({ type: 'tsvector', name: 'search_vector', select: false, nullable: true })
  @Index('idx_lcc_search', { synchronize: false }) // Postgres GIN index typically needs raw SQL
  searchVector: any;
}
