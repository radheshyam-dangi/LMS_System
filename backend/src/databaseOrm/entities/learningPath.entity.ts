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

  @Column({ type: 'jsonb', nullable: true })
  skillsTags: string[];

  @Column({ type: 'varchar', default: 'Active' })
  status: string;

  // 🌟 FIX: Add overallProgress column definition here
  @Column({ type: 'integer', name: 'overall_progress', default: 0 })
  overallProgress: number;

  @Column({ type: 'jsonb', nullable: true, default: [] })
  assignedToTraineeIds: string[];

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: UserEntity;

  @OneToMany(() => ModuleEntity, (module) => module.learningPath, { cascade: true })
  modules: ModuleEntity[];
}