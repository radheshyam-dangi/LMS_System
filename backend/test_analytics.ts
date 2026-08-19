import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AnalyticsEntityService } from './src/databaseOrm/modules/analytics/analytics.service';
import { UserEntity } from './src/databaseOrm/entities/user.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const analyticsService = app.get(AnalyticsEntityService);
  
  // Create a dummy admin user
  const adminUser = new UserEntity();
  adminUser.id = '00000000-0000-0000-0000-000000000000';
  (adminUser as any).roles = [{ name: 'admin' }];
  
  console.log("Calling getDashboardStats...");
  const stats = await analyticsService.getDashboardStats(adminUser as any);
  
  console.log("Stats output:", JSON.stringify({
      averageScore: stats.averageScore,
      completionRate: stats.completionRate,
      trainingEffectiveness: stats.trainingEffectiveness
  }, null, 2));

  await app.close();
}
bootstrap();
