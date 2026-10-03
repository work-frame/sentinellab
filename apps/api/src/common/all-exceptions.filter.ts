import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';

/**
 * Turns every error into a small JSON body. Unexpected errors are logged on
 * the server and reach the client only as "Internal server error", so stack
 * traces, SQL and file paths never leave the API.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ThrottlerException) {
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({ statusCode: 429, message: 'Too many requests. Try again later.' });
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : ((body as { message?: unknown }).message ?? exception.message);
      return res.status(status).json({ statusCode: status, message });
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') return res.status(404).json({ statusCode: 404, message: 'Not found' });
      if (exception.code === 'P2002') return res.status(409).json({ statusCode: 409, message: 'Already exists' });
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}
