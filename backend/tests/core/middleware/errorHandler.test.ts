import type { Request, Response } from 'express';
import { UnauthorizedError } from 'express-jwt';
import { coreErrorHandler, errorToHttpResponse } from '../../../src/core/middleware/errorHandler';
import { HttpClientError } from '../../../src/core/http/httpClient';
import { FormioApiError } from '../../../src/plugins/formio-v5/formioV5Client';
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

  it('errorToHttpResponse maps a Postgres unique violation to 409', () => {
    const result = errorToHttpResponse({ code: '23505', message: 'duplicate key' });
    expect(result.statusCode).toBe(409);
    expect(result.body.error).toBe('Resource already exists');
  });

  it('errorToHttpResponse maps a unique violation wrapped on the cause chain to 409', () => {
    const wrapped = Object.assign(new Error('query failed'), { cause: { code: '23505' } });
    expect(errorToHttpResponse(wrapped).statusCode).toBe(409);
  });

  it.each(['22P02', '22021', '22P05'])(
    'errorToHttpResponse maps Postgres input error %s on the cause chain to 400',
    (code) => {
      const wrapped = Object.assign(new Error('Failed query: select ... params: engine'), {
        cause: { code },
      });
      expect(errorToHttpResponse(wrapped)).toEqual({
        statusCode: 400,
        body: { error: 'Invalid input' },
      });
    },
  );

  it('errorToHttpResponse keeps the status of an exposed http-errors 4xx (body-parser)', () => {
    const parseError = Object.assign(new Error('Unexpected token } in JSON'), {
      status: 400,
      expose: true,
    });
    expect(errorToHttpResponse(parseError)).toEqual({
      statusCode: 400,
      body: { error: 'Unexpected token } in JSON' },
    });
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
    });
    expect(errorToHttpResponse(tooLarge).statusCode).toBe(413);
  });

  it('errorToHttpResponse keeps 401 for an express-jwt UnauthorizedError', () => {
    const err = new UnauthorizedError('invalid_token', { message: 'jwt malformed' });
    expect(errorToHttpResponse(err)).toEqual({ statusCode: 401, body: { error: 'jwt malformed' } });
  });

  it('errorToHttpResponse keeps 400 for the URIError Express raises on an undecodable param', () => {
    const err = Object.assign(new URIError("Failed to decode param '%E0%A4%A'"), {
      status: 400,
      statusCode: 400,
    });
    expect(errorToHttpResponse(err)).toEqual({
      statusCode: 400,
      body: { error: "Failed to decode param '%E0%A4%A'" },
    });
  });

  it.each([
    ['Form.io', new FormioApiError(401, 'Unauthorized', 'http://formio/form')],
    ['outbound HTTP', new HttpClientError(404, 'Not Found', 'no template', 'http://cdogs/render')],
  ])('errorToHttpResponse maps an upstream %s 4xx to a generic 500', (_label, err) => {
    expect(errorToHttpResponse(err)).toEqual({
      statusCode: 500,
      body: { error: 'Internal server error' },
    });
  });

  it('errorToHttpResponse returns 500 and Internal server error for generic Error', () => {
    const result = errorToHttpResponse(new Error('Failed query: select secret from soba.x'));
    expect(result.statusCode).toBe(500);
    expect(result.body.error).toBe('Internal server error');
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

  it('coreErrorHandler hands the error on once the response has started streaming', () => {
    const next = jest.fn();
    const res = { headersSent: true, status: jest.fn(), json: jest.fn() };
    const err = new Error('stream failed');
    coreErrorHandler(err, {} as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
