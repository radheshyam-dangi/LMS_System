import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { LearningPathEntity } from './learningPath.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';
@Entity(Entities.Enrollment)
export class EnrollmentEntity extends BaseEntity {
  @Column({
    type: 'timestamp',
    name: 'enrolledAt',
    default: () => 'CURRENT_TIMESTAMP',
  })
  enrolledAt: Date;

  @Column({ type: 'varchar', default: 'active' })
  status: string;

  // Relation: Many enrollments belong to 1 User
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Enrollment.UserId })
  user: UserEntity;

  // Relation: Many enrollments link to 1 Learning Path
  @ManyToOne(() => LearningPathEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.Enrollment.LearningPathId })
  learningPath: LearningPathEntity;

  // Relation: Who assigned this learning path to the user
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by_id' })
  assignedBy: UserEntity;
}
