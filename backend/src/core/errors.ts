import type { SubmitRefusalCode } from '@soba/lib';

/**
 * Typed error hierarchy for the core API.
 * Central error-handling middleware maps these to HTTP status codes.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    /** Why the request was refused, for a client to choose its own message; sent with `error`. */
    public readonly code?: SubmitRefusalCode,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found', code?: SubmitRefusalCode) {
    super(message, 404, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code?: SubmitRefusalCode) {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code?: SubmitRefusalCode) {
    super(message, 403, code);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', code?: SubmitRefusalCode) {
    super(message, 400, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code?: SubmitRefusalCode) {
    super(message, 409, code);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string = 'Payload too large', code?: SubmitRefusalCode) {
    super(message, 413, code);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string = 'Unsupported media type', code?: SubmitRefusalCode) {
    super(message, 415, code);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string = 'Unprocessable entity', code?: SubmitRefusalCode) {
    super(message, 422, code);
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', code?: SubmitRefusalCode) {
    super(message, 500, code);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable', code?: SubmitRefusalCode) {
    super(message, 503, code);
  }
}
