import { queuesSubmittedJob } from '../../../src/core/jobs/enqueue';

jest.mock('../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));

describe('queuesSubmittedJob', () => {
  it('queues a submit when the flag is on', async () => {
    await expect(queuesSubmittedJob('submitted', () => Promise.resolve(true))).resolves.toBe(true);
  });

  it('does not queue a submit when the flag is off', async () => {
    await expect(queuesSubmittedJob('submitted', () => Promise.resolve(false))).resolves.toBe(
      false,
    );
  });

  it('never queues a save, and does not read the flag for one', async () => {
    const isFlagOn = jest.fn().mockResolvedValue(true);
    await expect(queuesSubmittedJob('saved', isFlagOn)).resolves.toBe(false);
    expect(isFlagOn).not.toHaveBeenCalled();
  });
});
