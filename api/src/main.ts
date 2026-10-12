import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LastSeenInterceptor } from './common/interceptors/last-seen.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: false,
  });

  // Configuration de la limite de taille des requêtes (50MB)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global API prefix
  app.setGlobalPrefix('api');

  // Enable CORS - Allow all origins (protection via JWT)
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Domain'],
    credentials: true,
  });

  // whitelist: strip properties without class-validator decorators (mass assignment protection)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('FlowlyWeb API')
    .setDescription(
      `
    API for managing institutions and their styles.
    
    ## Authentication
    This API uses JWT Bearer authentication. To authenticate:
    1. First obtain a JWT token via the /auth/login endpoint
    2. Include the token in the Authorization header as: \`Bearer your_token_here\`
    3. For protected endpoints, look for the 🔒 lock icon
    
    ## Rate Limiting
    All endpoints are protected by rate limiting. You can make up to 5 requests per second.
  `,
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter your JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'Operations related to authentication and token management')
    .addTag('Institutions', 'Operations for managing institutions and their styles')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document);

  app.useGlobalInterceptors(app.get(LastSeenInterceptor));

  // await app.listen(process.env.PORT ?? 3000);
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1');

  // eslint-disable-next-line no-console
  console.log('API started on HOST :', process.env.HOST, ', PORT :', process.env.PORT);
}
void bootstrap();
