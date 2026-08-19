import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEntityService } from './analytics.service';
import { DashboardController } from './dashboard.controller';

@Module({
  controllers: [AnalyticsController, DashboardController],
  providers: [AnalyticsEntityService],
  exports: [AnalyticsEntityService],
})
export class AnalyticsModule {}
