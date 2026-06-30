import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
    
  app.enableCors({
    origin: 'http://localhost:5174', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    
    credentials: true, // Allow cookies and authorization headers
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`App is listening on port ${port}`);
}
bootstrap();
