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
};

@Injectable()
export class NotificationService {
  private repository: Repository<NotificationEntity>;

  constructor(private readonly datasource: DataSource) {
    this.repository = this.datasource.getRepository(NotificationEntity);
  }

  async create(dto: CreateNotificationDto): Promise<NotificationEntity> {
    const row = this.repository.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message ?? null,
      link: dto.link ?? null,
      relatedEntityType: dto.relatedEntityType ?? null,
      relatedEntityId: dto.relatedEntityId ?? null,
      isRead: false,
    } as Partial<NotificationEntity>);
    return await this.repository.save(row as NotificationEntity);
  }

  async createMany(dtos: CreateNotificationDto[]): Promise<NotificationEntity[]> {
    if (!dtos.length) return [];
    const rows = dtos.map((dto) =>
      this.repository.create({
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message ?? null,
        link: dto.link ?? null,
        relatedEntityType: dto.relatedEntityType ?? null,
        relatedEntityId: dto.relatedEntityId ?? null,
        isRead: false,
      } as Partial<NotificationEntity>),
    );
    return await this.repository.save(rows as NotificationEntity[]);
  }

  async findForUser(userId: string, unreadOnly = false): Promise<NotificationEntity[]> {
    return await this.repository.find({
      where: unreadOnly
        ? ({ userId, isRead: false } as any)
        : ({ userId } as any),
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return await this.repository.count({
      where: { userId, isRead: false } as any,
    });
  }

  async markAsRead(id: string, userId: string): Promise<NotificationEntity> {
    const note = await this.repository.findOne({ where: { id, userId } as any });
    if (!note) throw new NotFoundException('Notification not found.');
    if (!note.isRead) {
      note.isRead = true;
      note.readAt = new Date();
      return await this.repository.save(note);
    }
    return note;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.repository.update(
      { userId, isRead: false } as any,
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
    types: NotificationType[],
    relatedEntityId?: string,
  ): Promise<number> {
    if (!types.length) return 0;

    const where: any = {
      userId,
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
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<number> {
    const result = await this.repository.update(
      {
        userId,
        isRead: false,
        relatedEntityType,
        relatedEntityId,
      } as any,
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }
}
