import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsEntityService } from './analytics.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsEntityService) {}

  @Get('dashboard')
  @Roles('Admin', 'Trainer', 'Trainee')
  async dashboard() {
    return await this.analyticsService.getDashboardStats();
  }
}
