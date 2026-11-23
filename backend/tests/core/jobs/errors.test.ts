import { JobDeferredError } from '../../../src/core/jobs/errors';
import { MAX_DEFER_MS, MIN_DEFER_MS } from '../../../src/core/jobs/timing';

describe('JobDeferredError', () => {
  const waiting = 'Waiting for room in the email limit';

  it('carries its reason as its message and its delay, bounded', () => {
    const err = new JobDeferredError(0, waiting);
    expect(err.message).toBe(waiting);
    expect(err.delayMs).toBe(MIN_DEFER_MS);
    expect(new JobDeferredError(2 * MAX_DEFER_MS, waiting).delayMs).toBe(MAX_DEFER_MS);
  });
});
