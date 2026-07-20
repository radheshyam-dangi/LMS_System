import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonEntity } from './lesson.entity';
import { UserEntity } from './user.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.Assignment)
export class AssignmentEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  // 'Subjective' | 'MCQ'
  @Column({ type: 'varchar', name: 'assignment_type', default: 'Subjective' })
  assignmentType: string;

  // Stores MCQ Options & Correct Answer index as JSON string:
  // e.g. {"options":["Option A","Option B"],"correctIndex":0}
  @Column({ type: 'jsonb', nullable: true })
  mcqConfig: { options: string[]; correctIndex: number };

  @Column({ type: 'integer', name: 'max_score', default: 100 })
  maxScore: number;

  @Column({ type: 'timestamp', name: 'due_date', nullable: true })
  dueDate: Date;

  @ManyToOne(() => LessonEntity, (lesson) => lesson.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Assignment.LessonId })
  lesson: LessonEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: ForeignKeys.Assignment.CreatedBy })
  createdBy: UserEntity;
}