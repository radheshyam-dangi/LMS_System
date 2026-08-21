import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsEntityService } from './analytics.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { GetUser } from '../../../common/decorator/GetUser.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly analyticsService: AnalyticsEntityService) {}

  @Get('progress-trends')
  @Roles('Admin', 'Trainer', 'Trainee')
  async getProgressTrends(
    @GetUser() user: any,
    @Query('range') rangeStr: string,
    @Query('role') role: string,
    @Query('filter') filter: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const range = parseInt(rangeStr, 10) || 30;
    return await this.analyticsService.getDailyChartData(
      user,
      range,
      role,
      'progress',
      filter,
      startDate,
      endDate
    );
  }

  @Get('evaluation-score')
  @Roles('Admin', 'Trainer', 'Trainee')
  async getEvaluationScore(
    @GetUser() user: any,
    @Query('range') rangeStr: string,
    @Query('role') role: string,
    @Query('filter') filter: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const range = parseInt(rangeStr, 10) || 30;
    return await this.analyticsService.getDailyChartData(
      user,
      range,
      role,
      'score',
      filter,
      startDate,
      endDate
    );
  }
}
