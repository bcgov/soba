import { describe, it, expect } from 'vitest';
import type { SubmitRefusalCode } from '@soba/lib';
import { ApiError, parseJson } from '@/src/shared/api/sobaHelpers';
import { submitRefusalMessage } from '@/src/shared/api/dataError';

const errorResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** The error parseJson throws for a failed response. */
const refusalFrom = (response: Response): Promise<unknown> =>
  parseJson(response).then(
    () => {
      throw new Error('expected parseJson to throw');
    },
    (err: unknown) => err,
  );

describe('parseJson', () => {
  it('keeps the server message and a known refusal code', async () => {
    const err = await refusalFrom(
      errorResponse(403, {
        error: 'Drafts are not enabled for this form',
        code: 'drafts_disabled',
      }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      message: 'Drafts are not enabled for this form',
      status: 403,
      code: 'drafts_disabled',
    });
  });

  it.each([
    ['an unknown code', { error: 'No', code: 'not_a_refusal' }],
    ['no code', { error: 'No' }],
  ])('drops %s', async (_label, body) => {
    expect(await refusalFrom(errorResponse(403, body))).toMatchObject({ code: undefined });
  });
});

describe('submitRefusalMessage', () => {
  const messages = { drafts_disabled: 'Drafts are off.' } as Record<SubmitRefusalCode, string>;

  it('picks the message for a coded refusal', () => {
    const refused = new ApiError('Drafts are not enabled for this form', 403, 'drafts_disabled');
    expect(submitRefusalMessage(refused, messages)).toBe('Drafts are off.');
  });

  it.each([
    ['a refusal without a code', new ApiError('No', 403)],
    ['an error that is not an API error', new Error('boom')],
  ])('is null for %s', (_label, cause) => {
    expect(submitRefusalMessage(cause, messages)).toBeNull();
  });
});
