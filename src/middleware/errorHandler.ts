import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { config } from '../config/env';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    if (code !== undefined) {
      this.code = code;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

// Custom error types
export const createUnauthorizedError = (message = 'Unauthorized access') =>
  new AppError(message, 401, 'UNAUTHORIZED');

export const createForbiddenError = (message = 'Access forbidden') =>
  new AppError(message, 403, 'FORBIDDEN');

export const createValidationError = (message = 'Validation failed') =>
  new AppError(message, 400, 'VALIDATION_ERROR');

export const createConflictError = (message = 'Resource conflict') =>
  new AppError(message, 409, 'CONFLICT');

export const createNotFoundError = (message = 'Resource not found') =>
  new AppError(message, 404, 'NOT_FOUND');

export const createBadRequestError = (message = 'Bad request') =>
  new AppError(message, 400, 'BAD_REQUEST');

export const createInternalServerError = (message = 'Internal server error') =>
  new AppError(message, 500, 'INTERNAL_SERVER_ERROR');

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
  timestamp: string;
  path: string;
}

// Global error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = createNotFoundError(message);
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    const message = `Duplicate field value: ${field}`;
    error = createConflictError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors)
      .map((val: any) => val.message)
      .join(', ');
    error = createValidationError(message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = createUnauthorizedError(message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = createUnauthorizedError(message);
  }

  // Multer errors
  if (err.name === 'MulterError') {
    const message = 'File upload error';
    error = createBadRequestError(message);
  }

  // Default error
  const statusCode = (error as AppError).statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const code = (error as AppError).code || 'INTERNAL_SERVER_ERROR';

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message,
      code,
      ...(config.nodeEnv === 'development' && { stack: err.stack })
    },
    timestamp: new Date().toISOString(),
    path: req.url
  };

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = createNotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Unhandled promise rejection handler
export const handleUnhandledRejection = (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
};

// Uncaught exception handler
export const handleUncaughtException = (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
};

export default errorHandler;
