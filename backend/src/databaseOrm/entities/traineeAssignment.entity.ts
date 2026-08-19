import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AssignmentEntity } from './assignment.entity';
import { UserEntity } from './user.entity';

@Entity('TraineeAssignment')
export class TraineeAssignmentEntity extends BaseEntity {
  @ManyToOne(() => AssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: AssignmentEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainee_id' })
  trainee: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by_id' })
  assignedBy: UserEntity;

  @Column({
    type: 'timestamp',
    name: 'assigned_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  assignedAt: Date;
}
