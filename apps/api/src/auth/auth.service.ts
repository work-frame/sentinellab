import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, ClientInfo } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, RegisterDto } from './auth.dto';

export const MAX_FAILED_LOGINS = 10;
export const LOCKOUT_MINUTES = 15;

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations).
const ARGON_OPTIONS: argon2.HashOptions = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  /** Verified against when the email is unknown, so timing does not reveal which emails exist. */
  private dummyHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.dummyHash = argon2.hash(randomBytes(16).toString('hex'), ARGON_OPTIONS);
  }

  async register(dto: RegisterDto, client: ClientInfo) {
    if (!this.config.allowRegistration) throw new ForbiddenException('Registration is disabled');
    if (dto.password.toLowerCase().includes(dto.email.split('@')[0]!.toLowerCase())) {
      throw new BadRequestException('Password must not contain your email name');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Registration failed. If you already have an account, sign in instead.');

    const passwordHash = await argon2.hash(dto.password, ARGON_OPTIONS);
    // The first account on a fresh install becomes the admin.
    const isFirst = (await this.prisma.user.count()) === 0;
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash, role: isFirst ? 'ADMIN' : 'MEMBER' },
    });
    await this.audit.record({ action: 'auth.register', actorId: user.id, resourceType: 'user', resourceId: user.id, client });
    const token = await this.createSession(user.id, client);
    return { user: this.toPublic(user), token };
  }

  async login(dto: LoginDto, client: ClientInfo) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const invalid = new UnauthorizedException('Invalid email or password');

    if (!user) {
      await argon2.verify(await this.dummyHash, dto.password);
      await this.audit.record({ action: 'auth.login_failed', client, metadata: { reason: 'unknown_email' } });
      throw invalid;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.record({ action: 'auth.login_failed', actorId: user.id, client, metadata: { reason: 'locked' } });
      throw invalid;
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : user.lockedUntil,
        },
      });
      await this.audit.record({ action: 'auth.login_failed', actorId: user.id, client, metadata: { reason: 'bad_password', attempt: failed } });
      throw invalid;
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    const token = await this.createSession(user.id, client);
    await this.audit.record({ action: 'auth.login', actorId: user.id, resourceType: 'user', resourceId: user.id, client });
    return { user: this.toPublic(user), token };
  }

  async logout(user: AuthUser, client: ClientInfo) {
    await this.prisma.session.deleteMany({ where: { id: user.sessionId } });
    await this.audit.record({ action: 'auth.logout', actorId: user.id, resourceType: 'user', resourceId: user.id, client });
  }

  /** Look up the user behind a session token. Returns null for unknown or expired sessions. */
  async resolveSession(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session) return null;
    if (session.expiresAt <= new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    // Avoid a write on every request; five minutes of precision is enough.
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    }
    const { user } = session;
    return { id: user.id, email: user.email, name: user.name, role: user.role, sessionId: session.id };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.toPublic(user);
  }

  get sessionTtlMs(): number {
    return this.config.sessionTtlHours * 3_600_000;
  }

  private async createSession(userId: string, client: ClientInfo): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + this.sessionTtlMs),
        ipAddress: client.ipAddress,
        userAgent: client.userAgent,
      },
    });
    // Housekeeping: drop this user's expired sessions.
    await this.prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    return token;
  }

  private toPublic(user: { id: string; email: string; name: string; role: string; createdAt: Date }): PublicUser {
    return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
  }
}
