import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AssignmentEntity } from './assignment.entity';
import { UserEntity } from './user.entity';
import { AssignmentChatMessageEntity } from './assignmentChatMessage.entity';

@Entity('assignment_chat_threads')
export class AssignmentChatThreadEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'assignment_id' })
  assignmentId: string;

  @ManyToOne(() => AssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: AssignmentEntity;

  @Column({ type: 'uuid', name: 'trainee_id' })
  traineeId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainee_id' })
  trainee: UserEntity;

  @Column({ type: 'integer', default: 1 })
  attempt: number;

  @OneToMany(() => AssignmentChatMessageEntity, (message) => message.thread, {
    cascade: true,
  })
  messages: AssignmentChatMessageEntity[];
}
