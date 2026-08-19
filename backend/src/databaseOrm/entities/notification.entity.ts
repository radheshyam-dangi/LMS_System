import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { Entities } from '../../constants/entity';

export type NotificationType =
  | 'learning_path_assigned'
  | 'assignment_assigned'
  | 'submission_pending'
  | 'evaluation_completed'
  | 'general';

@Entity(Entities.Notification)
@Index(['userId', 'isRead'])
export class NotificationEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 64 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  /** Frontend route hint, e.g. /learning-paths, /assignments, /evaluations */
  @Column({ type: 'varchar', length: 255, nullable: true })
  link: string;

  @Column({
    type: 'varchar',
    name: 'related_entity_type',
    length: 64,
    nullable: true,
  })
  relatedEntityType: string;

  @Column({ type: 'uuid', name: 'related_entity_id', nullable: true })
  relatedEntityId: string;

  @Column({ type: 'boolean', name: 'is_read', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', name: 'read_at', nullable: true })
  readAt: Date;
}
