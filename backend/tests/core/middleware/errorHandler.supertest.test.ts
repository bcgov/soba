import express from 'express';
import request from 'supertest';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
import { NotFoundError, ValidationError, ForbiddenError, AppError } from '../../../src/core/errors';

function createErrorApp(throwInRoute: () => void): express.Express {
  const app = express();
  app.get('/', (_req, _res, next) => {
    try {
      throwInRoute();
    } catch (e) {
      next(e);
    }
  });
  app.use(coreErrorHandler);
  return app;
}

describe('errorHandler supertest', () => {
  it('returns 404 and error body when route throws NotFoundError', async () => {
    const app = createErrorApp(() => {
      throw new NotFoundError('Resource missing');
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Resource missing' });
  });

  it('returns 400 and error body when route throws ValidationError', async () => {
    const app = createErrorApp(() => {
      throw new ValidationError('Invalid input');
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid input' });
  });

  it('returns 403 and error body when route throws ForbiddenError', async () => {
    const app = createErrorApp(() => {
      throw new ForbiddenError('Access denied');
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Access denied' });
  });

  it('returns 500 and message when route throws generic Error', async () => {
    const app = createErrorApp(() => {
      throw new Error('Something broke');
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something broke' });
  });

  it('returns 500 and Internal server error when route throws non-Error', async () => {
    const app = createErrorApp(() => {
      throw 'string throw';
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('returns custom statusCode when route throws AppError with custom code', async () => {
    const app = createErrorApp(() => {
      throw new AppError('Teapot', 418);
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(418);
    expect(res.body).toEqual({ error: 'Teapot' });
  });
});
