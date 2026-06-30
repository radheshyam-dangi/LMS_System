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

  @Column({ type: 'varchar', name: 'difficulty_level', nullable: true })
  difficultyLevel: string;

  @Column({ type: 'varchar', name: 'assignment_type', nullable: true })
  assignmentType: string;

  @Column({ type: 'integer', name: 'max_score', nullable: true })
  maxScore: number;

  @Column({ type: 'timestamp', name: 'due_date', nullable: true })
  dueDate: Date;

  // Relation: Assignment belongs to a Lesson
  @ManyToOne(() => LessonEntity, (lesson) => lesson.assignments)
  @JoinColumn({ name: ForeignKeys.Assignment.LessonId })
  lesson: LessonEntity;

  // Relation: Assignment created by User
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: ForeignKeys.Assignment.CreatedBy })
  createdBy: UserEntity;
}