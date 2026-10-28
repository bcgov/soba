import { decideOutcome, errorText } from '../../../src/core/jobs/settlement';

const backoff = { backoffBaseMs: 30_000, backoffMaxMs: 1_800_000 };
const firstOfThree = { attempts: 1, maxAttempts: 3 };
const lastOfThree = { attempts: 3, maxAttempts: 3 };

describe('decideOutcome', () => {
  it.each([undefined, 'cancel', 'timeout', 'lease_lost', 'drain'] as const)(
    'records a success, whatever stopped it (%s)',
    (stopReason) => {
      expect(decideOutcome(undefined, stopReason, firstOfThree, backoff)).toEqual({
        kind: 'succeeded',
      });
    },
  );

  it('retries a failure with backoff while attempts remain', () => {
    expect(decideOutcome('boom', undefined, { attempts: 2, maxAttempts: 3 }, backoff)).toEqual({
      kind: 'retry',
      delayMs: 60_000,
      error: 'boom',
    });
  });

  it('ends a failure on its last attempt as dead', () => {
    expect(decideOutcome('boom', undefined, lastOfThree, backoff)).toEqual({
      kind: 'dead',
      error: 'boom',
    });
  });

  it('counts a timeout as a failed attempt', () => {
    expect(decideOutcome('Timed out', 'timeout', firstOfThree, backoff)).toEqual({
      kind: 'retry',
      delayMs: 30_000,
      error: 'Timed out',
    });
    expect(decideOutcome('Timed out', 'timeout', lastOfThree, backoff)).toEqual({
      kind: 'dead',
      error: 'Timed out',
    });
  });

  it('ends a failure after a cancel as cancelled, whatever the attempts', () => {
    expect(decideOutcome('aborted', 'cancel', firstOfThree, backoff)).toEqual({
      kind: 'cancelled',
      error: 'aborted',
    });
    expect(decideOutcome('aborted', 'cancel', lastOfThree, backoff)).toEqual({
      kind: 'cancelled',
      error: 'aborted',
    });
  });

  it('releases a failure after a drain, even on the last attempt', () => {
    expect(decideOutcome('aborted', 'drain', lastOfThree, backoff)).toEqual({ kind: 'release' });
  });

  it('writes nothing for a failure after a lost lease', () => {
    expect(decideOutcome('aborted', 'lease_lost', firstOfThree, backoff)).toBeNull();
  });
});

describe('errorText', () => {
  it('uses the message of an Error and the text of anything else', () => {
    expect(errorText(new Error('engine down'))).toBe('engine down');
    expect(errorText('plain')).toBe('plain');
  });

  it('keeps at most 2000 characters', () => {
    expect(errorText(new Error('x'.repeat(5000)))).toHaveLength(2000);
  });
});
