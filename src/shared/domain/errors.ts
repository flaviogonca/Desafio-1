/**
 * Framework-agnostic errors thrown by use cases and repositories.
 * The HTTP layer (AllExceptionsFilter) maps each one to a status code, so the
 * domain and application layers never depend on NestJS or HTTP.
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
}
export class UnauthorizedError extends AppError {
  readonly code = 'UNAUTHORIZED';
}
export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
}
export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
}
export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
}
