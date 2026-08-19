import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LearningPathEntity } from './learningPath.entity';
import { UserEntity } from './user.entity';
import { LessonEntity } from './lesson.entity';
import { ResourceEntity } from './resource.entity';

@Entity('Module')
export class ModuleEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Optional Cover Icon / Badge Image URL
  @Column({ type: 'varchar', nullable: true })
  imageUrl: string;

  // Release Status Badge (e.g. Active, Draft, Upcoming)
  @Column({ type: 'varchar', default: 'Active' })
  status: string;

  // Difficulty / Skill Level (e.g. Beginner, Intermediate, Advanced)
  @Column({ type: 'varchar', default: 'Beginner' })
  level: string;

  // DBML-aligned difficulty_level (kept alongside legacy `level`)
  @Column({ type: 'varchar', name: 'difficulty_level', default: 'Beginner' })
  difficultyLevel: string;

  /** e.g. "3 weeks" or numeric weeks */
  @Column({
    type: 'varchar',
    name: 'duration_label',
    nullable: true,
    default: '2 weeks',
  })
  durationLabel: string;

  @Column({
    type: 'integer',
    name: 'duration_weeks',
    nullable: true,
    default: 2,
  })
  durationWeeks: number;

  /** Learning objectives list */
  @Column({ type: 'jsonb', nullable: true, default: [] })
  objectives: string[];

  /** Learning outcomes list */
  @Column({ type: 'jsonb', nullable: true, default: [] })
  outcomes: string[];

  @ManyToOne(() => ModuleEntity, (module) => module.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentId' })
  parent?: ModuleEntity;

  @OneToMany(() => ModuleEntity, (module) => module.parent)
  children?: ModuleEntity[];

  @ManyToOne(() => LearningPathEntity, (lp) => lp.modules, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'learningPathId' })
  learningPath?: LearningPathEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy?: UserEntity;

  @OneToMany(() => LessonEntity, (lesson) => lesson.module, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  lessons: LessonEntity[];

  @OneToMany(() => ResourceEntity, (resource) => resource.module, {
    cascade: true,
  })
  resources: ResourceEntity[];
}
