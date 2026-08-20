export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, isOperational = true, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(message, 400, true, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Failed', details?: unknown) {
    super(message, 400, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found') {
    super(message, 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, true);
  }
}

export class RateLimitExhaustedError extends AppError {
  public readonly retryAfterMs: number;

  constructor(message = 'Hourly rate limit exhausted', retryAfterMs = 3600000) {
    super(message, 429, true, { retryAfterMs });
    this.retryAfterMs = retryAfterMs;
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', details?: unknown) {
    super(message, 500, false, details);
  }
}
