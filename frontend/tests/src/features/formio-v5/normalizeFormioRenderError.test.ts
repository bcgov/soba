import { describe, expect, it } from 'vitest';
import { normalizeFormioRenderError } from '@/src/features/formio-v5/normalizeFormioRenderError';

describe('normalizeFormioRenderError', () => {
  const fb = 'Fallback';

  it('uses Form.io API array of { error }', () => {
    const err = [{ error: 'User or password was incorrect', formattedKeyOrPath: '' }];
    expect(normalizeFormioRenderError(err, fb)).toBe('User or password was incorrect');
  });

  it('joins multiple API errors', () => {
    const err = [
      { error: 'First', formattedKeyOrPath: '' },
      { error: 'Second', formattedKeyOrPath: 'a' },
    ];
    expect(normalizeFormioRenderError(err, fb)).toBe('First; Second');
  });

  it('reads single object { error }', () => {
    expect(normalizeFormioRenderError({ error: 'Bad request', formattedKeyOrPath: '' }, fb)).toBe(
      'Bad request',
    );
  });

  it('reads { message } when error missing', () => {
    expect(normalizeFormioRenderError({ message: 'Msg' }, fb)).toBe('Msg');
  });

  it('returns fallback for empty array', () => {
    expect(normalizeFormioRenderError([], fb)).toBe(fb);
  });

  it('returns fallback for unrecognized object', () => {
    expect(normalizeFormioRenderError({ test: 1 }, fb)).toBe(fb);
  });
});
