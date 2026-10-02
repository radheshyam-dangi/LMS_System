import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AssignmentChatThreadEntity } from './assignmentChatThread.entity';

@Entity('assignment_chat_messages')
export class AssignmentChatMessageEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'thread_id' })
  threadId: string;

  @ManyToOne(() => AssignmentChatThreadEntity, (thread) => thread.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'thread_id' })
  thread: AssignmentChatThreadEntity;

  @Column({ type: 'varchar', length: 50 })
  role: 'system' | 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', name: 'question_ids', nullable: true })
  questionIds: string[];

  @Column({ type: 'jsonb', name: 'lesson_ids', nullable: true })
  lessonIds: string[];

  @Column({ type: 'varchar', nullable: true })
  intent: string;

  @Column({ type: 'boolean', default: false })
  blocked: boolean;

  @Column({ type: 'varchar', name: 'prompt_version', nullable: true })
  promptVersion: string;

  @Column({ type: 'integer', nullable: true })
  tokens: number;
}
