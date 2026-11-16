jest.mock('../../../../src/core/db/client', () => ({ db: {} }));

import {
  createFormVersionDraft,
  nextFormVersionNo,
} from '../../../../src/core/db/repos/formVersionRepo';
import type { Tx } from '../../../../src/core/db/client';

/** A select chain that resolves to `rows` at whichever builder method the query ends on. */
const chain = (rows: unknown[]) => {
  const end = Promise.resolve(rows) as Promise<unknown[]> & Record<string, jest.Mock>;
  for (const name of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'offset', 'for']) {
    end[name] = jest.fn(() => end);
  }
  return end;
};

/** A transaction whose selects read the form row, then the newest numbered version. */
const txReading = (form: unknown[], latest: unknown[] = []) => {
  const formQuery = chain(form);
  const latestQuery = chain(latest);
  const values = jest.fn((row: object) => ({ returning: () => Promise.resolve([row]) }));
  const tx = {
    select: jest.fn().mockReturnValueOnce(formQuery).mockReturnValueOnce(latestQuery),
    insert: jest.fn(() => ({ values })),
  } as unknown as Tx;
  return { tx, formQuery, values };
};

describe('formVersionRepo', () => {
  it('numbers the next version one past the newest numbered one', async () => {
    const { tx } = txReading([{ deletedAt: null }], [{ versionNo: 1 }]);

    await expect(nextFormVersionNo('ws1', 'f1', tx)).resolves.toBe(2);
  });

  it('numbers a form with no saved version 1', async () => {
    const { tx } = txReading([{ deletedAt: null }]);

    await expect(nextFormVersionNo('ws1', 'f1', tx)).resolves.toBe(1);
  });

  // The form row is locked first, so versions of one form are numbered one at a time.
  it('locks the form before numbering its version', async () => {
    const { tx, formQuery } = txReading([{ deletedAt: null }]);

    await nextFormVersionNo('ws1', 'f1', tx);

    expect(formQuery.for).toHaveBeenCalledWith('no key update');
  });

  it.each([
    ['deleted', [{ deletedAt: new Date() }]],
    ['missing', []],
  ])('refuses to number a version of a %s form', async (_label, form) => {
    const { tx } = txReading(form);

    await expect(nextFormVersionNo('ws1', 'f1', tx)).rejects.toThrow('Form not found');
  });

  it('creates a version opened, under the next version number', async () => {
    const { tx, values } = txReading([{ deletedAt: null }], [{ versionNo: 2 }]);

    await createFormVersionDraft(
      {
        id: 'v3',
        workspaceId: 'ws1',
        formId: 'f1',
        actorId: 'a1',
        actorDisplayLabel: 'Author',
        engineSchemaRef: 'eng-3',
      },
      tx,
    );

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'v3', versionNo: 3, state: 'opened', currentRevisionNo: 0 }),
    );
  });
});
