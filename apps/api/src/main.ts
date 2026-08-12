import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';
import { requestIdMiddleware } from './http/request-id.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: (process.env.APP_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true
  });

  const openApiConfig = new DocumentBuilder()
    .setTitle('DevLeague API')
    .setDescription('Contrato HTTP da alpha fechada V0.1.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const openApi = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('api/docs', app, openApi, {
    jsonDocumentUrl: 'api/docs-json'
  });

  const port = Number.parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(Number.isNaN(port) ? 3001 : port, '0.0.0.0');
}

void bootstrap();
