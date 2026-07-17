import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { ModuleEntity } from './module.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.LearningPath)
export class LearningPathEntity extends BaseEntity {

  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true }) 
  status: string;

  @Column({ type: 'varchar', default: 'Intermediate' })
  difficulty: string;

  @Column({ type: 'varchar', default: '12 weeks' })
  duration: string;

  @Column({ type: 'simple-array', nullable: true })
  skillsTags: string[];

  @Column({ type: 'simple-array', nullable: true })
  assignedToTraineeIds: string[];

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: ForeignKeys.LearningPath.CreatedBy })
  createdBy: UserEntity;

  @OneToMany(() => ModuleEntity, (module) => module.learningPath)
  modules: ModuleEntity[];
}