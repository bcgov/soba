import {
  ApiErrorSchema,
  IdParamSchema,
  EnqueueProvisionSchema,
} from '../../../../src/core/api/shared/schema';

describe('api shared schema', () => {
  it('IdParamSchema parses valid id', () => {
    const result = IdParamSchema.parse({ id: 'abc' });
    expect(result.id).toBe('abc');
  });

  it('IdParamSchema rejects empty id', () => {
    expect(() => IdParamSchema.parse({ id: '' })).toThrow();
  });

  it('IdParamSchema safeParse returns success for valid id', () => {
    const r = IdParamSchema.safeParse({ id: 'x' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBe('x');
  });

  it('IdParamSchema safeParse returns error for missing id', () => {
    const r = IdParamSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('ApiErrorSchema parses object with error string', () => {
    const result = ApiErrorSchema.parse({ error: 'Something failed' });
    expect(result.error).toBe('Something failed');
  });

  it('ApiErrorSchema rejects non-string error', () => {
    expect(() => ApiErrorSchema.parse({ error: 123 })).toThrow();
  });

  it('EnqueueProvisionSchema parses true', () => {
    expect(EnqueueProvisionSchema.parse(true)).toBe(true);
  });

  it('EnqueueProvisionSchema parses undefined', () => {
    expect(EnqueueProvisionSchema.parse(undefined)).toBeUndefined();
  });

  it('EnqueueProvisionSchema optional accepts boolean', () => {
    expect(EnqueueProvisionSchema.parse(false)).toBe(false);
  });
});
