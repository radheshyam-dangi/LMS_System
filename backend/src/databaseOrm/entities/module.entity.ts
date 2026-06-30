import { Entity, Column, ManyToOne, JoinColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { LearningPathEntity } from './learningPath.entity';
import { LessonEntity } from './lesson.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.Module)
export class ModuleEntity extends BaseEntity {

  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', name: 'difficulty_level', nullable: true })
  difficultyLevel: string;

  @Column({ type: 'varchar', nullable: true })
  status: string;

  // Self-referencing relationship (parent_id points back to Module)
  @ManyToOne(() => ModuleEntity, (module) => module.subModules, { nullable: true })
  @JoinColumn({ name: ForeignKeys.Module.ParentId })
  parent: ModuleEntity;

  @OneToMany(() => ModuleEntity, (module) => module.parent)
  subModules: ModuleEntity[];

  // Relation: Many modules belong to a LearningPath
  @ManyToOne(() => LearningPathEntity, (lp) => lp.modules)
  learningPath: LearningPathEntity;

  // Relation: Created By User
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: ForeignKeys.Module.CreatedBy })
  createdBy: UserEntity;

  // Relation: One Module has Many Lessons
  @OneToMany(() => LessonEntity, (lesson) => lesson.module)
  lessons: LessonEntity[];
}