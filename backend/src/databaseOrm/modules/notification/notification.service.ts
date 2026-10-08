import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import {
  NotificationEntity,
  NotificationType,
} from '../../entities/notification.entity';

export type CreateNotificationDto = {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  recipientRole?: string;
};

function getRecipientRoleForType(type: NotificationType): string {
  switch (type) {
    case 'learning_path_assigned':
    case 'assignment_assigned':
    case 'evaluation_completed':
      return 'trainee';
    case 'submission_pending':
    case 'ai_evaluation_ready':
    case 'ai_evaluation_failed':
      return 'trainer';
    case 'general':
    default:
      return 'trainee';
  }
}

@Injectable()
export class NotificationService {
  private repository: Repository<NotificationEntity>;

  constructor(private readonly datasource: DataSource) {
    this.repository = this.datasource.getRepository(NotificationEntity);
  }

  async create(dto: CreateNotificationDto): Promise<NotificationEntity> {
    const recipientRole = dto.recipientRole || getRecipientRoleForType(dto.type);
    const row = this.repository.create({
      userId: dto.userId,
      recipientRole,
      type: dto.type,
      title: dto.title,
      message: dto.message ?? null,
      link: dto.link ?? null,
      relatedEntityType: dto.relatedEntityType ?? null,
      relatedEntityId: dto.relatedEntityId ?? null,
      isRead: false,
    } as Partial<NotificationEntity>);
    return await this.repository.save(row);
  }

  async createMany(
    dtos: CreateNotificationDto[],
  ): Promise<NotificationEntity[]> {
    if (!dtos.length) return [];
    const rows = dtos.map((dto) =>
      this.repository.create({
        userId: dto.userId,
        recipientRole: dto.recipientRole || getRecipientRoleForType(dto.type),
        type: dto.type,
        title: dto.title,
        message: dto.message ?? null,
        link: dto.link ?? null,
        relatedEntityType: dto.relatedEntityType ?? null,
        relatedEntityId: dto.relatedEntityId ?? null,
        isRead: false,
      } as Partial<NotificationEntity>),
    );
    return await this.repository.save(rows);
  }

  async findForUser(
    userId: string,
    activeRole: string,
    unreadOnly = false,
  ): Promise<NotificationEntity[]> {
    const role = activeRole.toLowerCase();
    return await this.repository.find({
      where: unreadOnly ? { userId, recipientRole: role, isRead: false } : { userId, recipientRole: role },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async countUnread(userId: string, activeRole: string): Promise<number> {
    const role = activeRole.toLowerCase();
    return await this.repository.count({
      where: { userId, recipientRole: role, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string, activeRole: string): Promise<NotificationEntity> {
    const role = activeRole.toLowerCase();
    const note = await this.repository.findOne({
      where: { id, userId, recipientRole: role },
    });
    if (!note) throw new NotFoundException('Notification not found.');
    if (!note.isRead) {
      note.isRead = true;
      note.readAt = new Date();
      return await this.repository.save(note);
    }
    return note;
  }

  async markAllAsRead(userId: string, activeRole: string): Promise<number> {
    const role = activeRole.toLowerCase();
    const result = await this.repository.update(
      { userId, recipientRole: role, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /**
   * Mark unread notifications by type (and optional related entity).
   * Used when trainee opens Learning Paths / Assignments, or trainer opens Evaluations.
   */
  async markByTypes(
    userId: string,
    activeRole: string,
    types: NotificationType[],
    relatedEntityId?: string,
  ): Promise<number> {
    if (!types.length) return 0;
    const role = activeRole.toLowerCase();

    const where: any = {
      userId,
      recipientRole: role,
      isRead: false,
      type: In(types),
    };
    if (relatedEntityId) {
      where.relatedEntityId = relatedEntityId;
    }

    const result = await this.repository.update(where, {
      isRead: true,
      readAt: new Date(),
    });
    return result.affected ?? 0;
  }

  async markByRelatedEntity(
    userId: string,
    activeRole: string,
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<number> {
    const role = activeRole.toLowerCase();
    const result = await this.repository.update(
      {
        userId,
        recipientRole: role,
        isRead: false,
        relatedEntityType,
        relatedEntityId,
      },
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /**
   * Supersede: mark existing unread notifications for the same entity as read,
   * then create a new one. Prevents notification duplication on resubmission cycles.
   */
  async supersede(dto: CreateNotificationDto): Promise<NotificationEntity> {
    const recipientRole = dto.recipientRole || getRecipientRoleForType(dto.type);
    // Mark existing unread notifications for this entity as read
    if (dto.relatedEntityType && dto.relatedEntityId) {
      await this.repository.update(
        {
          userId: dto.userId,
          recipientRole,
          isRead: false,
          relatedEntityType: dto.relatedEntityType,
          relatedEntityId: dto.relatedEntityId,
        },
        { isRead: true, readAt: new Date() },
      );
    }
    return await this.create(dto);
  }

  async deleteNotification(id: string, userId: string, activeRole: string): Promise<boolean> {
    const role = activeRole.toLowerCase();
    const note = await this.repository.findOne({
      where: { id, userId, recipientRole: role },
    });
    if (!note) throw new NotFoundException('Notification not found.');
    await this.repository.remove(note);
    return true;
  }
}
