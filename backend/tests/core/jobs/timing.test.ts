import {
  backoffDelayMs,
  deferDelayMs,
  jitteredMs,
  MAX_DEFER_MS,
  MIN_DEFER_MS,
  withRetries,
} from '../../../src/core/jobs/timing';

const backoff = { backoffBaseMs: 30_000, backoffMaxMs: 1_800_000 };

describe('backoffDelayMs', () => {
  it('starts at the base and doubles per attempt', () => {
    expect([1, 2, 3, 4].map((attempt) => backoffDelayMs(attempt, backoff))).toEqual([
      30_000, 60_000, 120_000, 240_000,
    ]);
  });

  it('stops at the cap', () => {
    expect(backoffDelayMs(7, backoff)).toBe(1_800_000);
    expect(backoffDelayMs(2000, backoff)).toBe(1_800_000);
  });
});

describe('deferDelayMs', () => {
  it('keeps a delay from a second to a day, in whole milliseconds', () => {
    expect(deferDelayMs(1500.4)).toBe(1500);
    expect(deferDelayMs(MIN_DEFER_MS)).toBe(MIN_DEFER_MS);
    expect(deferDelayMs(MAX_DEFER_MS)).toBe(MAX_DEFER_MS);
  });

  it.each([
    [0, MIN_DEFER_MS],
    [-5, MIN_DEFER_MS],
    [999, MIN_DEFER_MS],
    [Number.NEGATIVE_INFINITY, MIN_DEFER_MS],
    [Number.NaN, MIN_DEFER_MS],
    ['soon', MIN_DEFER_MS],
    [undefined, MIN_DEFER_MS],
    [2 * MAX_DEFER_MS, MAX_DEFER_MS],
    [Number.POSITIVE_INFINITY, MAX_DEFER_MS],
  ])('bounds a delay of %s to %s ms', (ms, expected) => {
    expect(deferDelayMs(ms)).toBe(expected);
  });
});

describe('jitteredMs', () => {
  it('stays within a fifth either way', () => {
    expect(jitteredMs(2000, () => 0)).toBe(1600);
    expect(jitteredMs(2000, (max) => max - 1)).toBe(2400);
  });

  it('asks for a value across the whole spread', () => {
    const random = jest.fn().mockReturnValue(0);
    jitteredMs(10_000, random);
    expect(random).toHaveBeenCalledWith(4001);
  });

  it('never goes past the largest timer delay', () => {
    expect(jitteredMs(2_147_483_647, (max) => max - 1)).toBe(2_147_483_647);
  });

  it('leaves a delay too short to spread unchanged', () => {
    expect(jitteredMs(0)).toBe(0);
    expect(jitteredMs(4)).toBe(4);
  });
});

describe('withRetries', () => {
  it('returns once a try succeeds', async () => {
    const write = jest
      .fn()
      .mockRejectedValueOnce(new Error('blip'))
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValue(true);
    await expect(withRetries(write, 3, 0)).resolves.toBe(true);
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once the retries are used up', async () => {
    const write = jest.fn().mockRejectedValue(new Error('down'));
    await expect(withRetries(write, 2, 0)).rejects.toThrow('down');
    expect(write).toHaveBeenCalledTimes(3);
  });
});
