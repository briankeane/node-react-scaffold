export class AppError extends Error {
  data?: unknown;

  constructor(message: string, data?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.data = data;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends AppError {}

export class AuthenticationError extends AppError {}

export class PermissionError extends AppError {}

export class ValidationError extends AppError {}

export class ConflictError extends AppError {}

export class ServerError extends AppError {
  constructor(message = "An unexpected error occurred", data?: unknown) {
    super(message, data);
  }
}

export const ErrorMessages = {
  RESOURCE_NOT_FOUND: "The requested resource could not be found.",
  AUTHENTICATION_REQUIRED:
    "Authentication is required to access this resource.",
  FORBIDDEN: "You do not have permission to perform this action.",
  VALIDATION_FAILED: "The provided data is invalid.",
  CONFLICT: "The request could not be completed due to a conflict.",
  SERVER_ERROR: "An unexpected error occurred.",
  FAILED_TO_GENERATE_TOKEN: "There was an error generating the auth token.",
  ACCESS_TOKEN_REQUIRED:
    "This endpoint requires a Bearer token in the Authorization header.",
  BASIC_AUTH_REQUIRED:
    "This endpoint requires Basic authentication in the Authorization header.",
  USER_LACKS_PERMISSION_TO_EDIT_STATION:
    "The user lacks permission to edit this station.",
  ADMIN_REQUIRED: "This action requires admin privileges.",
  invalidUuidFormat: (field: string) => `Invalid UUID format for ${field}.`,
};

export const createNotFoundError = (message: string, data?: unknown) =>
  new NotFoundError(message, data);
export const createAuthenticationError = (message: string, data?: unknown) =>
  new AuthenticationError(message, data);
export const createPermissionError = (message: string, data?: unknown) =>
  new PermissionError(message, data);
export const createValidationError = (message: string, data?: unknown) =>
  new ValidationError(message, data);
export const createConflictError = (message: string, data?: unknown) =>
  new ConflictError(message, data);
export const createServerError = (message: string, data?: unknown) =>
  new ServerError(message, data);
