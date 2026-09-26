import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonEntity } from './lesson.entity';

@Entity('LessonRubric')
@Unique(['lesson', 'rubricVersion'])
export class LessonRubricEntity extends BaseEntity {
  @ManyToOne(() => LessonEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: LessonEntity;

  @Column({ type: 'integer', name: 'content_version', nullable: false })
  contentVersion: number;

  @Column({ type: 'integer', name: 'rubric_version', nullable: false })
  rubricVersion: number;

  @Column({ type: 'jsonb', name: 'key_points', nullable: false, default: [] })
  keyPoints: any; // Array of { point: string, weight: number }

  @Column({ type: 'varchar', name: 'generation_status', default: 'PENDING' })
  generationStatus: string; // PENDING | SUCCESS | FAILED

  @Column({ type: 'timestamp', name: 'generated_at', nullable: true })
  generatedAt: Date | null;
}
