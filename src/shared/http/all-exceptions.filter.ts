import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../domain/errors';

/** Every error leaves the API in the same shape: { statusCode, error, message, path, timestamp }. */
interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { statusCode, message } = this.translate(exception);
    if (statusCode >= 500) {
      // Never leak internals to the client; log them for us.
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    const body: ErrorBody = {
      statusCode,
      error: STATUS_NAMES[statusCode] ?? 'Error',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }

  private translate(exception: unknown): { statusCode: number; message: string | string[] } {
    if (exception instanceof ValidationError) return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message };
    if (exception instanceof UnauthorizedError) return { statusCode: HttpStatus.UNAUTHORIZED, message: exception.message };
    if (exception instanceof ForbiddenError) return { statusCode: HttpStatus.FORBIDDEN, message: exception.message };
    if (exception instanceof NotFoundError) return { statusCode: HttpStatus.NOT_FOUND, message: exception.message };
    if (exception instanceof ConflictError) return { statusCode: HttpStatus.CONFLICT, message: exception.message };
    if (exception instanceof AppError) return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message };

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'string' ? res : ((res as { message?: string | string[] }).message ?? exception.message);
      return { statusCode: exception.getStatus(), message };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
