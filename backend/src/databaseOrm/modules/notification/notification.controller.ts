import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationType } from '../../entities/notification.entity';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(
    @GetUser() currentUser: any,
    @Headers('x-active-role') activeRole: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    const items = await this.notificationService.findForUser(
      userId,
      activeRole || 'trainee',
      unreadOnly === 'true' || unreadOnly === '1',
    );
    const unreadCount = await this.notificationService.countUnread(userId, activeRole || 'trainee');
    return { items, unreadCount };
  }

  @Get('unread-count')
  async unreadCount(@GetUser() currentUser: any, @Headers('x-active-role') activeRole: string) {
    const userId = currentUser?.id || currentUser?.sub;
    const count = await this.notificationService.countUnread(userId, activeRole || 'trainee');
    return { count };
  }

  @Put(':id/read')
  async markRead(@Param('id') id: string, @GetUser() currentUser: any, @Headers('x-active-role') activeRole: string) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.notificationService.markAsRead(id, userId, activeRole || 'trainee');
  }

  @Post('mark-read')
  async markByCategory(
    @GetUser() currentUser: any,
    @Headers('x-active-role') activeRole: string,
    @Body()
    body: {
      types?: NotificationType[];
      relatedEntityId?: string;
      relatedEntityType?: string;
      all?: boolean;
    },
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    const role = activeRole || 'trainee';

    if (body?.all) {
      const affected = await this.notificationService.markAllAsRead(userId, role);
      const unreadCount = await this.notificationService.countUnread(userId, role);
      return { affected, unreadCount };
    }

    if (body?.relatedEntityType && body?.relatedEntityId) {
      const affected = await this.notificationService.markByRelatedEntity(
        userId,
        role,
        body.relatedEntityType,
        body.relatedEntityId,
      );
      const unreadCount = await this.notificationService.countUnread(userId, role);
      return { affected, unreadCount };
    }

    const types = body?.types || [];
    const affected = await this.notificationService.markByTypes(
      userId,
      role,
      types,
      body?.relatedEntityId,
    );
    const unreadCount = await this.notificationService.countUnread(userId, role);
    return { affected, unreadCount };
  }

  @Post('mark-all-read')
  async markAll(@GetUser() currentUser: any, @Headers('x-active-role') activeRole: string) {
    const userId = currentUser?.id || currentUser?.sub;
    const affected = await this.notificationService.markAllAsRead(userId, activeRole || 'trainee');
    return { affected, unreadCount: 0 };
  }

  @Delete(':id')
  async deleteNotification(
    @Param('id') id: string,
    @GetUser() currentUser: any,
    @Headers('x-active-role') activeRole: string,
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.notificationService.deleteNotification(id, userId, activeRole || 'trainee');
  }
}
