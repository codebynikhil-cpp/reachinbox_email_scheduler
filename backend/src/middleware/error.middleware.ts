import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Handle Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    logger.warn('Validation Error', {
      path: req.path,
      method: req.method,
      errors: formattedErrors,
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    });
    return;
  }

  // Handle Multer File Upload Errors
  if (err instanceof MulterError) {
    logger.warn('File Upload Error', {
      path: req.path,
      code: err.code,
      message: err.message,
    });

    res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
    return;
  }

  // Handle Custom AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Operational Server Error', {
        path: req.path,
        method: req.method,
        message: err.message,
        details: err.details,
      });
    } else {
      logger.warn('Client Error', {
        path: req.path,
        method: req.method,
        statusCode: err.statusCode,
        message: err.message,
        details: err.details,
      });
    }

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Handle Unexpected Errors
  logger.error('Unhandled Exception', {
    path: req.path,
    method: req.method,
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
  });
}
