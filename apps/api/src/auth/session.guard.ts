import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../common/decorators';
import type { AuthedRequest } from '../common/request-context';
import { AuthService } from './auth.service';

export const SESSION_COOKIE = 'sl_session';

/** Global guard: every route needs a valid session unless marked @Public(). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw new UnauthorizedException('Not signed in');
    const user = await this.auth.resolveSession(token);
    if (!user) throw new UnauthorizedException('Session expired. Sign in again.');
    req.user = user;
    return true;
  }
}
