import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { AnalyticsEntityService } from './analytics.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { GetUser } from '../../../common/decorator/GetUser.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsEntityService) {}

  @Post('streak/celebrate')
  @Roles('Trainee')
  async celebrateStreak(
    @GetUser() user: any,
    @Body() body: { currentStreak: number },
  ) {
    return await this.analyticsService.updateLastCelebratedStreak(
      user,
      body.currentStreak,
    );
  }

  @Get('dashboard')
  @Roles('Admin', 'Trainer', 'Trainee')
  async dashboard(@GetUser() user: any, @Query('role') role?: string) {
    return await this.analyticsService.getDashboardStats(user, role);
  }
}
