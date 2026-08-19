import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { UserEntity } from './user.entity';
import { Entities } from '../../constants/entity';

@Entity(Entities.LearningPath)
export class LearningPathEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', default: 'Intermediate' })
  difficulty: string;

  @Column({ type: 'varchar', default: '12 weeks' })
  duration: string;

  // 🌟 Skill tags list (e.g., ['React', 'TypeScript', 'Node'])
  @Column({ type: 'jsonb', nullable: true, default: [] })
  skillsTags: string[];

  // 🌟 Release status badge (Active vs. Upcoming)
  @Column({ type: 'varchar', default: 'Active' })
  status: string;

  // 🌟 Optional Cover Image / Icon URL
  @Column({ type: 'varchar', nullable: true })
  imageUrl: string;

  // 🌟 Overall progress completion percentage
  @Column({ type: 'integer', name: 'overall_progress', default: 0 })
  overallProgress: number;

  // 🌟 Array of assigned Trainee User UUIDs
  @Column({ type: 'jsonb', nullable: true, default: [] })
  assignedToTraineeIds: string[];

  // 🌟 Creator / Owner Relation (Used to verify write permissions)
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: UserEntity;

  // 🌟 Nested Modules with automatic cascading cleanup
  @OneToMany(() => ModuleEntity, (module) => module.learningPath, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  modules: ModuleEntity[];
}
