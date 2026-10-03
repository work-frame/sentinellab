import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/env';

export const CSRF_HEADER = 'x-sentinellab-csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defense for cookie-authenticated requests, in two layers:
 * 1. Every state-changing request must carry the custom X-SentinelLab-CSRF
 *    header. Browsers only let another site set custom headers after a CORS
 *    preflight, and this API answers no cross-origin preflights.
 * 2. If the browser sends an Origin header, it must be one of WEB_ORIGIN.
 * The session cookie is also SameSite=Lax.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (req.headers[CSRF_HEADER] !== '1') throw new ForbiddenException('Missing CSRF header');
    const origin = req.headers.origin;
    if (origin && !this.config.webOrigins.includes(origin)) throw new ForbiddenException('Origin not allowed');
    return true;
  }
}
