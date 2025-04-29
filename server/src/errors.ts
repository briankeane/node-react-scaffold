// Base error class that extends the native Error
export class AppError extends Error {
  data?: { [key: string]: string | number };

  constructor(message: string, data?: { [key: string]: string | number }) {
    super(message);
    this.name = this.constructor.name;
    this.data = data;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication errors
export class AuthenticationError extends AppError {
  constructor(message: string, data?: [[key: string], value: string | number]) {
    super(message, data);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, data?: { [key: string]: string | number }) {
    super(message, data);
  }
}
