import { NextFunction, Request, Response } from 'express';
import logger from '../logger';
import {
  AppError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  PermissionError,
  ServerError,
  ValidationError,
} from '../utils/errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;

  if (err instanceof NotFoundError) {
    statusCode = 404;
  } else if (err instanceof AuthenticationError) {
    statusCode = 401;
  } else if (err instanceof PermissionError) {
    statusCode = 403;
  } else if (err instanceof ValidationError) {
    statusCode = 400;
  } else if (err instanceof ConflictError) {
    statusCode = 409;
  } else if (err instanceof ServerError) {
    statusCode = 500;
  } else if (err instanceof AppError) {
    statusCode = 400;
  }

  if (
    err.name === 'SequelizeValidationError' ||
    err.name === 'SequelizeUniqueConstraintError'
  ) {
    statusCode = 400;
    const seqErr = err as Error & { errors: Array<{ path: string; message: string }> };
    const validationErrors = seqErr.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));

    logger.error('Validation Error', {
      errors: validationErrors,
      path: req.path,
      method: req.method,
    });

    return res.status(statusCode).json({
      error: {
        message: 'Validation error',
        data: validationErrors,
      },
    });
  }

  if (err instanceof AppError) {
    logger.error(`${err.name}: ${err.message}`, {
      statusCode,
      data: err.data,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Unhandled Server Error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  const errorResponse: { error: { message: string; data?: unknown } } = {
    error: {
      message: err.message || 'An unexpected error occurred',
    },
  };

  if (err instanceof AppError && err.data) {
    errorResponse.error.data = err.data;
  }

  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    errorResponse.error.message = 'Internal Server Error';
  }

  return res.status(statusCode).json(errorResponse);
}
