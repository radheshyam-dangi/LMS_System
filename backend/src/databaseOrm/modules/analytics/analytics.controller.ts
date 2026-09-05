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
  async dashboard(@GetUser() user: any, @Query('role') role?: string, @Query('traineeId') traineeId?: string, @Query('trainerId') trainerId?: string) {
    const isTrainer = role 
      ? role.toLowerCase() === 'trainer'
      : user?.roles?.some((r: any) => String(r.name || r).toLowerCase() === 'trainer') || 
        user?.primaryRole?.name === 'Trainer';

    if (isTrainer) {
      return await this.analyticsService.getTrainerDashboardSummary(user);
    }
    return await this.analyticsService.getDashboardStats(user, role, traineeId, trainerId);
  }

  @Get('trainer/:trainerId/dashboard-summary')
  @Roles('Trainer')
  async getTrainerDashboardSummaryV2(@GetUser() user: any) {
    // Ensuring the endpoint is authenticated via the guards, we use the user token's identity.
    return await this.analyticsService.getTrainerDashboardSummaryV2(user);
  }
}
