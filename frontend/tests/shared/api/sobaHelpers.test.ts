import { describe, it, expect } from 'vitest';
import type { SubmitErrorCode } from '@soba/lib';
import { ApiError, parseJson } from '@/src/shared/api/sobaHelpers';
import { submitErrorMessage } from '@/src/shared/api/dataError';

const errorResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** The error parseJson throws for a failed response. */
const errorFrom = (response: Response): Promise<unknown> =>
  parseJson(response).then(
    () => {
      throw new Error('expected parseJson to throw');
    },
    (err: unknown) => err,
  );

describe('parseJson', () => {
  it('keeps the server message and a known error code', async () => {
    const err = await errorFrom(
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
    ['an unknown code', { error: 'No', code: 'not_a_code' }],
    ['no code', { error: 'No' }],
  ])('drops %s', async (_label, body) => {
    expect(await errorFrom(errorResponse(403, body))).toMatchObject({ code: undefined });
  });
});

describe('submitErrorMessage', () => {
  const messages = { drafts_disabled: 'Drafts are off.' } as Record<SubmitErrorCode, string>;

  it('picks the message for a coded error', () => {
    const refused = new ApiError('Drafts are not enabled for this form', 403, 'drafts_disabled');
    expect(submitErrorMessage(refused, messages)).toBe('Drafts are off.');
  });

  it.each([
    ['an error without a code', new ApiError('No', 403)],
    ['an error that is not an API error', new Error('boom')],
  ])('is null for %s', (_label, cause) => {
    expect(submitErrorMessage(cause, messages)).toBeNull();
  });

  it.each([
    ['a server failure', new ApiError('Internal server error', 500), 'Try again.'],
    ['a request that never reached the server', new TypeError('Failed to fetch'), 'Try again.'],
    ['a coded error', new ApiError('No', 403, 'drafts_disabled'), 'Drafts are off.'],
    ['an uncoded client error', new ApiError('Engine says no', 400), null],
  ])('with a fallback, answers %s', (_label, cause, expected) => {
    expect(submitErrorMessage(cause, messages, 'Try again.')).toBe(expected);
  });
});
