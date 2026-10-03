import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { AppConfig } from './config/env';
import { CSRF_HEADER } from './common/csrf.guard';

/**
 * Shared HTTP setup for main.ts and the integration tests, so tests exercise
 * the same middleware, validation and headers as production.
 */
export function configureApp(app: INestApplication, config: AppConfig): void {
  const express = app as NestExpressApplication;
  express.set('trust proxy', config.trustProxy);
  express.disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          frameAncestors: ["'none'"],
          // Only upgrade to HTTPS in production; local development runs on plain HTTP.
          upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // No CORS: the web app reaches the API through a same-origin proxy.

  if (config.swaggerEnabled) {
    const doc = new DocumentBuilder()
      .setTitle('SentinelLab API')
      .setDescription(
        `Authorized security testing API. Sign in through POST /api/auth/login; the session lives in an HttpOnly cookie. ` +
          `Every POST, PATCH and DELETE must send the header "${CSRF_HEADER}: 1".`,
      )
      .setVersion('0.1.0')
      .addCookieAuth('sl_session', { type: 'apiKey', in: 'cookie', name: 'sl_session' }, 'session')
      .addGlobalParameters({ name: CSRF_HEADER, in: 'header', required: false, schema: { type: 'string', example: '1' } })
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'api/docs/openapi.json' });
  }
}
