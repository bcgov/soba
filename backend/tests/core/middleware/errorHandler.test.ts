import { errorToHttpResponse } from '../../../src/core/middleware/errorHandler';
import { AppError, NotFoundError, ValidationError } from '../../../src/core/errors';

describe('errorHandler', () => {
  it('errorToHttpResponse returns statusCode and body for AppError', () => {
    const err = new NotFoundError('Resource missing');
    const result = errorToHttpResponse(err);
    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({ error: 'Resource missing' });
  });

  it('errorToHttpResponse returns 400 for ValidationError', () => {
    const err = new ValidationError('Invalid input');
    const result = errorToHttpResponse(err);
    expect(result.statusCode).toBe(400);
    expect(result.body.error).toBe('Invalid input');
  });

  it('errorToHttpResponse returns 500 and message for generic Error', () => {
    const result = errorToHttpResponse(new Error('Something broke'));
    expect(result.statusCode).toBe(500);
    expect(result.body.error).toBe('Something broke');
  });

  it('errorToHttpResponse returns 500 and Internal server error for non-Error throw', () => {
    const result = errorToHttpResponse('string throw');
    expect(result.statusCode).toBe(500);
    expect(result.body.error).toBe('Internal server error');
  });

  it('errorToHttpResponse returns custom statusCode for AppError subclass', () => {
    const err = new AppError('Custom', 418);
    const result = errorToHttpResponse(err);
    expect(result.statusCode).toBe(418);
    expect(result.body.error).toBe('Custom');
  });
});
