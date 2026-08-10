import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEntityService } from './analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsEntityService],
  exports: [AnalyticsEntityService],
})
export class AnalyticsModule {}
