import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  InternalError,
} from '../../src/core/errors';

describe('errors', () => {
  it('AppError sets message and statusCode and name', () => {
    const err = new AppError('msg', 418);
    expect(err.message).toBe('msg');
    expect(err.statusCode).toBe(418);
    expect(err.name).toBe('AppError');
  });

  it('NotFoundError has statusCode 404 and default message', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('NotFoundError');
  });

  it('NotFoundError accepts custom message', () => {
    const err = new NotFoundError('Resource missing');
    expect(err.message).toBe('Resource missing');
    expect(err.statusCode).toBe(404);
  });

  it('ForbiddenError has statusCode 403 and default message', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Forbidden');
    expect(err.name).toBe('ForbiddenError');
  });

  it('ValidationError has statusCode 400 and default message', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Validation failed');
    expect(err.name).toBe('ValidationError');
  });

  it('ConflictError has statusCode 409 and default message', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('Conflict');
    expect(err.name).toBe('ConflictError');
  });

  it('InternalError has statusCode 500 and default message', () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('Internal server error');
    expect(err.name).toBe('InternalError');
  });

  it('all errors are instanceof AppError', () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
    expect(new ValidationError()).toBeInstanceOf(AppError);
    expect(new ConflictError()).toBeInstanceOf(AppError);
    expect(new InternalError()).toBeInstanceOf(AppError);
  });
});
