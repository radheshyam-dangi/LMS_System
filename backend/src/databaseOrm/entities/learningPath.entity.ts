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

  @Column({ type: 'varchar', nullable: true }) // maps back to your DBML enum type
  status: string;

  // Relation: Many learning paths can be created by 1 User
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: ForeignKeys.LearningPath.CreatedBy })
  createdBy: UserEntity;

  // Relation: One-to-Many with Modules via your mapped ModuleEntity configuration
  @OneToMany(() => ModuleEntity, (module) => module.learningPath)
  modules: ModuleEntity[];
}