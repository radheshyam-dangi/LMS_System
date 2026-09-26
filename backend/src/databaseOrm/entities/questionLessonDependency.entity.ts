import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonEntity } from './lesson.entity';

@Entity('QuestionLessonDependency')
@Unique(['questionId', 'lesson'])
export class QuestionLessonDependencyEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', name: 'question_id', nullable: false })
  questionId: string; // Refers to the UUID in AssignmentEntity.questions

  @Index()
  @ManyToOne(() => LessonEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: LessonEntity;

  @Column({ type: 'numeric', precision: 4, scale: 3, default: 1.0 })
  weight: number;

  @Column({ type: 'varchar', default: 'creator' })
  source: string; // 'creator' | 'backfill'
}

