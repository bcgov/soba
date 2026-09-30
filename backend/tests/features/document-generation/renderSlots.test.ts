import { withRenderSlot } from '../../../src/features/document-generation/renderSlots';

describe('withRenderSlot', () => {
  it('runs the render and returns its result', async () => {
    await expect(withRenderSlot(1, async () => 'rendered')).resolves.toBe('rendered');
  });

  it('is busy while every slot is taken, and runs again once one frees', async () => {
    let finish: () => void = () => undefined;
    const first = withRenderSlot(
      1,
      () => new Promise<string>((resolve) => (finish = () => resolve('first'))),
    );
    try {
      await expect(withRenderSlot(1, async () => 'second')).resolves.toBe('busy');
    } finally {
      finish();
    }
    await expect(first).resolves.toBe('first');
    await expect(withRenderSlot(1, async () => 'third')).resolves.toBe('third');
  });

  it('frees the slot when the render throws', async () => {
    await expect(
      withRenderSlot(1, () => Promise.reject(new Error('backend down'))),
    ).rejects.toThrow('backend down');
    await expect(withRenderSlot(1, async () => 'after')).resolves.toBe('after');
  });
});
