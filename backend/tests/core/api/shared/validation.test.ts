import { z } from 'zod';
import {
  validateRequestPayload,
  type RequestSchemas,
  type ValidationResult,
} from '../../../../src/core/api/shared/validation';
import { IdParamSchema } from '../../../../src/core/api/shared/schema';

function isFailure(r: ValidationResult): r is Extract<ValidationResult, { ok: false }> {
  return !r.ok;
}

describe('validation', () => {
  it('validateRequestPayload returns ok true and parsed body when body schema passes', () => {
    const schemas: RequestSchemas = {
      body: z.object({ name: z.string() }),
    };
    const result = validateRequestPayload(schemas, { body: { name: 'Alice' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toEqual({ name: 'Alice' });
    }
  });

  it('validateRequestPayload returns ok false and details when body schema fails', () => {
    const schemas: RequestSchemas = {
      body: z.object({ name: z.string().min(1) }),
    };
    const result = validateRequestPayload(schemas, { body: { name: '' } });
    expect(result.ok).toBe(false);
    if (!isFailure(result)) return;
    expect(result.error).toBe('Invalid request body');
    expect(result.details.length).toBeGreaterThan(0);
    expect(result.details[0]).toHaveProperty('path');
    expect(result.details[0]).toHaveProperty('message');
    expect(result.details[0]).toHaveProperty('code');
  });

  it('validateRequestPayload returns ok true and parsed params when params schema passes', () => {
    const schemas: RequestSchemas = { params: IdParamSchema };
    const result = validateRequestPayload(schemas, {
      params: { id: 'form-123' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.params).toEqual({ id: 'form-123' });
    }
  });

  it('validateRequestPayload returns ok false when params schema fails', () => {
    const schemas: RequestSchemas = { params: IdParamSchema };
    const result = validateRequestPayload(schemas, { params: { id: '' } });
    expect(result.ok).toBe(false);
    if (!isFailure(result)) return;
    expect(result.error).toBe('Invalid request params');
  });

  it('validateRequestPayload returns ok true and parsed query when query schema passes', () => {
    const schemas: RequestSchemas = {
      query: z.object({ limit: z.coerce.number() }),
    };
    const result = validateRequestPayload(schemas, {
      query: { limit: 10 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.query).toEqual({ limit: 10 });
    }
  });

  it('validateRequestPayload returns ok false for invalid query', () => {
    const schemas: RequestSchemas = {
      query: z.object({ limit: z.coerce.number() }),
    };
    const result = validateRequestPayload(schemas, {
      query: { limit: 'not-a-number' },
    });
    expect(result.ok).toBe(false);
    if (!isFailure(result)) return;
    expect(result.error).toBe('Invalid request query');
  });

  it('validateRequestPayload validates body then params then query and returns first failure', () => {
    const schemas: RequestSchemas = {
      body: z.object({ x: z.number() }),
      params: IdParamSchema,
    };
    const result = validateRequestPayload(schemas, {
      body: { x: 'not a number' },
      params: { id: 'ok' },
    });
    expect(result.ok).toBe(false);
    if (!isFailure(result)) return;
    expect(result.error).toBe('Invalid request body');
  });

  it('validateRequestPayload returns ok true when no schemas provided', () => {
    const result = validateRequestPayload({}, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({});
  });
});
