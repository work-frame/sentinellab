import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { SessionGuard } from './auth/session.guard';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { CsrfGuard } from './common/csrf.guard';
import { ConfigModule } from './config/config.module';
import { APP_CONFIG, type AppConfig } from './config/env';
import { DashboardModule } from './dashboard/dashboard.module';
import { DemoModule } from './demo/demo.module';
import { FindingsModule } from './findings/findings.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { ScansModule } from './scans/scans.module';
import { TargetsModule } from './targets/targets.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    // Default: 300 requests per minute per IP. Auth routes set stricter limits.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({ prefix: config.queuePrefix, connection: { url: config.redisUrl, maxRetriesPerRequest: null } }),
    }),
    AuthModule,
    TargetsModule,
    ScansModule,
    FindingsModule,
    ReportsModule,
    DashboardModule,
    DemoModule,
    HealthModule,
  ],
  providers: [
    // Order matters: rate limit first, then CSRF, then authentication.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
