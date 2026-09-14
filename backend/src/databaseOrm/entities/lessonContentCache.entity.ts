import { Entity, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonEntity } from './lesson.entity';

@Entity('LessonContentCache')
export class LessonContentCacheEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @OneToOne(() => LessonEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: LessonEntity;

  /** Plain text extracted from the lesson's rich-text description */
  @Column({ type: 'text', name: 'description_text', nullable: true })
  descriptionText: string;

  /** Transcript extracted from video content (YouTube captions or Whisper) */
  @Column({ type: 'text', name: 'video_transcript', nullable: true })
  videoTranscript: string;

  /** Transcript extracted from audio content (Whisper) */
  @Column({ type: 'text', name: 'audio_transcript', nullable: true })
  audioTranscript: string;

  /** Text extracted from resource files (PDF text, webpage text) */
  @Column({ type: 'text', name: 'resource_text', nullable: true })
  resourceText: string;

  /**
   * Overall extraction status:
   * - 'pending'   — extraction queued but not started
   * - 'completed' — all available content successfully extracted
   * - 'partial'   — some content extracted, some failed
   * - 'failed'    — all extraction attempts failed
   */
  @Column({
    type: 'varchar',
    name: 'extraction_status',
    default: 'pending',
  })
  extractionStatus: string;

  @Column({ type: 'timestamp', name: 'extracted_at', nullable: true })
  extractedAt: Date;

  @Column({ type: 'text', name: 'failure_reason', nullable: true })
  failureReason: string;
}
