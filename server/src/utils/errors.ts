export class AppError extends Error {
  data?: unknown;

  constructor(message: string, data?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.data = data;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, data?: unknown) {
    super(message, data);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, data?: unknown) {
    super(message, data);
  }
}

export class PermissionError extends AppError {
  constructor(message: string, data?: unknown) {
    super(message, data);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, data?: unknown) {
    super(message, data);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, data?: unknown) {
    super(message, data);
  }
}

export class ServerError extends AppError {
  constructor(message: string = 'An unexpected error occurred', data?: unknown) {
    super(message, data);
  }
}

export const ErrorMessages = {
  ACCESS_TOKEN_REQUIRED:
    'This endpoint requires a Bearer token in the Authorization header',
  BASIC_AUTH_REQUIRED:
    'This endpoint requires a Basic token in the Authorization header',
  INVALID_UUID_FORMAT: 'Invalid UUID format',
  USER_NOT_FOUND: 'User not found',
  ADMIN_REQUIRED: 'This action requires admin privileges',

  invalidUuidFormat: (paramName: string): string =>
    `Invalid UUID format for ${paramName}`,
  invalidBodyField: (field: string, allowedValues: string[]): string =>
    `Invalid ${field}. Must be one of: ${allowedValues.join(', ')}`,
  missingPermission: (permission: string): string =>
    `Missing required permission: ${permission}`,
};
