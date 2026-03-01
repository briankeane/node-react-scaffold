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
  ACCESS_TOKEN_REQUIRED:
    "Invalid credentials: accessToken required for this endpoint.",
  BASIC_AUTH_REQUIRED: "Basic authentication is required for this endpoint.",
  INVALID_UUID_FORMAT: "Invalid UUID format.",
  USER_NOT_FOUND: "User not found.",
  ADMIN_REQUIRED: "Admin role is required to perform this action.",

  invalidUuidFormat: (paramName: string) =>
    `Invalid UUID format for parameter: ${paramName}.`,
  invalidBodyField: (field: string, allowedValues: string[]) =>
    `Invalid value for '${field}'. Allowed values: ${allowedValues.join(", ")}.`,
  missingPermission: (permission: string) =>
    `Missing required permission: ${permission}.`,
} as const;
