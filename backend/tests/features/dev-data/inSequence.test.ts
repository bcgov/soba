import { inSequence } from '../../../src/features/dev-data/inSequence';

describe('inSequence', () => {
  it('runs one step at a time, in order, and returns results in item order', async () => {
    const events: string[] = [];
    const results = await inSequence([30, 10, 20], async (delay, index) => {
      events.push(`start ${index}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      events.push(`end ${index}`);
      return delay * 2;
    });
    expect(results).toEqual([60, 20, 40]);
    expect(events).toEqual(['start 0', 'end 0', 'start 1', 'end 1', 'start 2', 'end 2']);
  });

  it('stops at the first failure', async () => {
    const ran: number[] = [];
    await expect(
      inSequence([1, 2, 3], async (item) => {
        ran.push(item);
        if (item === 2) throw new Error('step 2 failed');
        return item;
      }),
    ).rejects.toThrow('step 2 failed');
    expect(ran).toEqual([1, 2]);
  });

  it('resolves to an empty list for no items', async () => {
    await expect(inSequence([], async () => 1)).resolves.toEqual([]);
  });
});
