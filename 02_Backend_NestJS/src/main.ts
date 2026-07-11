import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Sécurité HTTP de base (§13.9, §13.10)
  app.use(helmet());
  app.use(compression());

  // CORS restreint aux origines connues (web + apps mobiles via proxy)
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  console.log('CORS — origines autorisées :', allowedOrigins);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Validation stricte des DTOs sur toutes les routes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Préfixe global de version API
  app.setGlobalPrefix('api/v1');

  // Documentation Swagger (§14.2)
  const config = new DocumentBuilder()
    .setTitle('GymCloud API')
    .setDescription('API SaaS multi-tenant de gestion de salles de sport')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`GymCloud API démarrée sur le port ${port}`);
}

bootstrap();
