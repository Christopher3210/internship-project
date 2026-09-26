import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: 'http://localhost:3000' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const document = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle('Internship Admin API')
    .setDescription('User registration and login APIs')
    .setVersion('1.0')
    .build());
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
