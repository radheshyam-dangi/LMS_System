import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { AssignmentEntity } from './assignment.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.Lesson)
export class LessonEntity extends BaseEntity {

  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'integer', name: 'duration_minutes', nullable: true })
  durationMinutes: number;

  @Column({ type: 'integer', name: 'display_order', nullable: true })
  displayOrder: number;

  // Relation: Lesson belongs to a Module
  @ManyToOne(() => ModuleEntity, (module) => module.lessons)
  @JoinColumn({ name: ForeignKeys.Lesson.ModuleId })
  module: ModuleEntity;

  // Relation: One Lesson has many Assignments
  @OneToMany(() => AssignmentEntity, (assignment) => assignment.lesson)
  assignments: AssignmentEntity[];
}