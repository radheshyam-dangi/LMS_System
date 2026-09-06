import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEntityService } from './analytics.service';
import { DashboardController } from './dashboard.controller';
import { TrainerController } from './trainer.controller';

import { ProgressModule } from '../progress/progress.module';

@Module({
  imports: [ProgressModule],
  controllers: [AnalyticsController, DashboardController, TrainerController],
  providers: [AnalyticsEntityService],
  exports: [AnalyticsEntityService],
})
export class AnalyticsModule {}
