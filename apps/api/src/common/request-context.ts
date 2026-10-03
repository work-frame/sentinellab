import type { Request } from 'express';
import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  sessionId: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export interface ClientInfo {
  ipAddress: string | null;
  userAgent: string | null;
}

export function clientInfo(req: Request): ClientInfo {
  const ua = req.headers['user-agent'];
  return { ipAddress: req.ip ?? null, userAgent: typeof ua === 'string' ? ua.slice(0, 300) : null };
}
