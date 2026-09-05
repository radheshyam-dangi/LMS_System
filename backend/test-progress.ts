import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ProgressEntityService } from './src/databaseOrm/modules/progress/progress.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const progressService = app.get(ProgressEntityService);
  
  // Use the trainee's user ID
  const userId = 'f16c7645-c4a6-4cd1-a240-d0942a66c3c0';
  
  try {
    console.log("Calling getPathProgressSummary...");
    const summary = await progressService.getPathProgressSummary(userId);
    console.log("Summary:", JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
  
  await app.close();
}

bootstrap();
