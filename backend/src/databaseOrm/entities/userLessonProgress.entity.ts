import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { LessonEntity } from './lesson.entity';
import { Entities } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.UserLessonProgress)
@Unique(['user', 'lesson'])
export class UserLessonProgressEntity extends BaseEntity {
  @Column({ type: 'timestamp', name: 'completedAt', default: () => 'CURRENT_TIMESTAMP' })
  completedAt: Date;

  @Column({ type: 'boolean', default: true })
  isCompleted: boolean;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.UserLessonProgress.UserId })
  user: UserEntity;

  @ManyToOne(() => LessonEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: ForeignKeys.UserLessonProgress.LessonId })
  lesson: LessonEntity;
}