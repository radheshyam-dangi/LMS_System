import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AnalyticsEntityService } from './databaseOrm/modules/analytics/analytics.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const analyticsService = app.get(AnalyticsEntityService);
  
  const userId = 'f16c7645-c4a6-4cd1-a240-d0942a66c3c0'; // Reva Kub
  try {
    const stats = await analyticsService.getDashboardStats({ id: userId, roles: [{name: 'Trainee'}] }, 'trainee');
    console.log(JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error(err);
  }
  
  await app.close();
}
bootstrap();
