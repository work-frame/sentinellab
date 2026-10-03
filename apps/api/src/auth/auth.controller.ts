import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { CurrentUser, Public } from '../common/decorators';
import { clientInfo, type AuthUser } from '../common/request-context';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './session.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.config.cookieSecure, sameSite: 'lax', path: '/', maxAge: this.auth.sessionTtlMs };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Create an account and start a session. Limited to 5 per 10 minutes per IP.' })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.register(dto, clientInfo(req));
    res.cookie(SESSION_COOKIE, token, this.cookieOptions());
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in. Limited to 10 attempts per minute per IP; accounts lock for 15 minutes after 10 failures.' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto, clientInfo(req));
    res.cookie(SESSION_COOKIE, token, this.cookieOptions());
    return { user };
  }

  @ApiCookieAuth('session')
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'End the current session.' })
  async logout(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user, clientInfo(req));
    const { maxAge: _maxAge, ...opts } = this.cookieOptions();
    res.clearCookie(SESSION_COOKIE, opts);
  }

  @ApiCookieAuth('session')
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user.' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
