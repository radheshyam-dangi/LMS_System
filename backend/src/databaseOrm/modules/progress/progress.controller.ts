import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ProgressEntityService } from './progress.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { GetUser } from '../../../common/decorator/GetUser.decorator';

@Controller('progress')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressEntityService) {}

  @Post('lessons/:lessonId/complete')
  @Roles('Trainee', 'Trainer', 'Admin')
  async completeLesson(@Param('lessonId') lessonId: string, @GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    if (!userId) throw new ForbiddenException('User session missing.');
    return await this.progressService.completeLesson(userId, lessonId);
  }

  @Post('resources/:resourceId/visit')
  @Roles('Trainee', 'Trainer', 'Admin')
  async visitResource(@Param('resourceId') resourceId: string, @GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    if (!userId) throw new ForbiddenException('User session missing.');
    return await this.progressService.visitResource(userId, resourceId);
  }

  @Get('me')
  @Roles('Trainee', 'Trainer', 'Admin')
  async myProgress(@GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.progressService.findForUser(userId);
  }

  @Get('stats/me')
  @Roles('Trainee', 'Trainer', 'Admin')
  async myStats(
    @GetUser() currentUser: any,
    @Query('learningPathId') learningPathId?: string,
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.progressService.statsForUser(userId, learningPathId);
  }

  @Get('cohort')
  @Roles('Admin', 'Trainer')
  async cohort(@GetUser() currentUser: any) {
    const trainerId = currentUser?.id || currentUser?.sub;
    return await this.progressService.cohortOverview(trainerId);
  }

  @Get('learning-paths/summary')
  @Roles('Trainee', 'Trainer', 'Admin')
  async pathProgressSummary(@GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.progressService.getPathProgressSummary(userId);
  }

  @Get('user/:userId')
  @Roles('Admin', 'Trainer')
  async userProgress(
    @Param('userId') userId: string,
    @Query('learningPathId') learningPathId?: string,
  ) {
    return await this.progressService.statsForUser(userId, learningPathId);
  }
}
