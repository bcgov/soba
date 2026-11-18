import { DrizzleQueryError } from 'drizzle-orm/errors';
import {
  decideOutcome,
  errorText,
  handlerEnding,
  JobCancelledError,
  JobDeferredError,
  JobFailedError,
} from '../../../src/core/jobs/settlement';
import { MAX_DEFER_MS, MIN_DEFER_MS } from '../../../src/core/jobs/timing';

const backoff = { backoffBaseMs: 30_000, backoffMaxMs: 1_800_000 };
const firstOfThree = { attempts: 1, maxAttempts: 3 };
const lastOfThree = { attempts: 3, maxAttempts: 3 };
const permanent = { permanent: true };
const deferred = { deferMs: 60_000 };
const waiting = 'Waiting for room in the email limit';

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

  it('ends a permanent failure dead on its first attempt, a timeout included', () => {
    expect(decideOutcome('too big', undefined, firstOfThree, backoff, permanent)).toEqual({
      kind: 'dead',
      error: 'too big',
    });
    expect(decideOutcome('Timed out', 'timeout', firstOfThree, backoff, permanent)).toEqual({
      kind: 'dead',
      error: 'Timed out',
    });
  });

  it('lets a cancel, a drain or a lost lease decide before a permanent failure', () => {
    expect(decideOutcome('too big', 'cancel', firstOfThree, backoff, permanent)).toEqual({
      kind: 'cancelled',
      error: 'too big',
    });
    expect(decideOutcome('too big', 'drain', firstOfThree, backoff, permanent)).toEqual({
      kind: 'release',
    });
    expect(decideOutcome('too big', 'lease_lost', firstOfThree, backoff, permanent)).toBeNull();
  });

  it('defers with the delay asked for and the error text as its reason', () => {
    expect(decideOutcome(waiting, undefined, firstOfThree, backoff, deferred)).toEqual({
      kind: 'defer',
      delayMs: 60_000,
      reason: waiting,
    });
  });

  it('defers on the last attempt, since a deferral uses none', () => {
    expect(decideOutcome(waiting, undefined, lastOfThree, backoff, deferred)).toEqual({
      kind: 'defer',
      delayMs: 60_000,
      reason: waiting,
    });
  });

  it('bounds the delay it defers by', () => {
    expect(decideOutcome(waiting, undefined, firstOfThree, backoff, { deferMs: 0 })).toEqual({
      kind: 'defer',
      delayMs: MIN_DEFER_MS,
      reason: waiting,
    });
  });

  it('lets a cancel, a drain, a lost lease or a timeout decide before a deferral', () => {
    expect(decideOutcome(waiting, 'cancel', firstOfThree, backoff, deferred)).toEqual({
      kind: 'cancelled',
      error: waiting,
    });
    expect(decideOutcome(waiting, 'drain', firstOfThree, backoff, deferred)).toEqual({
      kind: 'release',
    });
    expect(decideOutcome(waiting, 'lease_lost', firstOfThree, backoff, deferred)).toBeNull();
    expect(decideOutcome('Timed out', 'timeout', firstOfThree, backoff, deferred)).toEqual({
      kind: 'retry',
      delayMs: 30_000,
      error: 'Timed out',
    });
    expect(decideOutcome('Timed out', 'timeout', lastOfThree, backoff, deferred)).toEqual({
      kind: 'dead',
      error: 'Timed out',
    });
  });
});

describe('JobDeferredError', () => {
  it('carries its reason as its message and its delay, bounded', () => {
    const err = new JobDeferredError(0, waiting);
    expect(err.message).toBe(waiting);
    expect(err.delayMs).toBe(MIN_DEFER_MS);
    expect(new JobDeferredError(2 * MAX_DEFER_MS, waiting).delayMs).toBe(MAX_DEFER_MS);
  });

  it('waits the least when code without types gives no delay', () => {
    expect(new JobDeferredError(undefined as unknown as number, waiting).delayMs).toBe(
      MIN_DEFER_MS,
    );
  });
});

describe('handlerEnding', () => {
  it('reads a permanent failure and a deferral from what the handler threw', () => {
    expect(handlerEnding(new JobFailedError('too big'))).toEqual({ permanent: true });
    expect(handlerEnding(new JobDeferredError(60_000, waiting))).toEqual({ deferMs: 60_000 });
  });

  it('reads nothing from any other error', () => {
    expect(handlerEnding(new Error('engine down'))).toEqual({});
    expect(handlerEnding(new JobCancelledError('gone'))).toEqual({});
    expect(handlerEnding('plain')).toEqual({});
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

  // pg's DatabaseError, which Drizzle wraps with the query and its values.
  const pgError = (fields: Record<string, string>) =>
    Object.assign(new Error('duplicate key value violates unique constraint'), {
      severity: 'ERROR',
      ...fields,
    });
  const query = 'insert into "soba"."notification_audit" values ($1)';
  const values = ['a@example.com'];

  it('names a database error by its code and constraint, never its query or values', () => {
    const err = new DrizzleQueryError(
      query,
      values,
      pgError({ code: '23505', constraint: 'notification_audit_pkey' }),
    );
    expect(errorText(err)).toBe('Database error 23505 on notification_audit_pkey');
    expect(errorText(new DrizzleQueryError(query, values, pgError({ code: '57014' })))).toBe(
      'Database error 57014',
    );
  });

  it('names a failed query by its cause alone when it has no database error', () => {
    expect(errorText(new DrizzleQueryError(query, values, new TypeError('a@example.com')))).toBe(
      'Database query failed: TypeError',
    );
    expect(errorText(new DrizzleQueryError(query, values))).toBe('Database query failed');
  });
});
