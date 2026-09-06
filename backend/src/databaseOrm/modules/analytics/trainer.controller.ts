import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnalyticsEntityService } from './analytics.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { GetUser } from '../../../common/decorator/GetUser.decorator';

@Controller('trainer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrainerController {
  constructor(private readonly analyticsService: AnalyticsEntityService) {}

  @Get('trainees/:traineeId/summary')
  @Roles('Trainer')
  async getTraineeSummary(
    @GetUser() user: any,
    @Param('traineeId') traineeId: string,
  ) {
    const trainerId = user.id || user.sub;
    return await this.analyticsService.getTraineeSummaryForTrainer(trainerId, traineeId);
  }

  @Get('learning-paths/:lpId/trainees-progress')
  @Roles('Trainer')
  async getLearningPathTraineesProgress(
    @GetUser() user: any,
    @Param('lpId') lpId: string,
  ) {
    const trainerId = user.id || user.sub;
    return await this.analyticsService.getLearningPathTraineesProgress(trainerId, lpId);
  }
}
