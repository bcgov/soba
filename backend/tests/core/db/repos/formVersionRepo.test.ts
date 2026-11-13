const selectMock = jest.fn();
const txSelectMock = jest.fn();

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    transaction: (run: (tx: unknown) => Promise<unknown>) =>
      run({ select: (...args: unknown[]) => txSelectMock(...args) }),
  },
}));

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  createFormVersionDraft,
  getCurrentFormVersion,
  listFormVersionsForWorkspace,
  lookupFormVersions,
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

const render = (condition: SQL) => new PgDialect().sqlToQuery(condition);

/** The where clause a query ended on leaves opened versions out. */
const expectNoOpened = (query: ReturnType<typeof chain>) => {
  const where = render(query.where.mock.calls[0][0] as SQL);
  expect(where.sql).toContain('"soba"."form_version"."state" <> $');
  expect(where.params).toContain('opened');
};

describe('formVersionRepo', () => {
  beforeEach(() => {
    selectMock.mockReset();
    txSelectMock.mockReset();
  });

  // One left unsaved holds no number, so the next version takes the number it showed.
  it('numbers the next version after the saved ones only', async () => {
    const latest = chain([{ versionNo: 1 }]);
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(chain([{ deletedAt: null }]))
        .mockReturnValueOnce(latest),
    } as unknown as Tx;

    await expect(nextFormVersionNo('ws1', 'f1', tx)).resolves.toBe(2);
    expectNoOpened(latest);
  });

  it('numbers a form with no saved version 1', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(chain([{ deletedAt: null }]))
        .mockReturnValueOnce(chain([])),
    } as unknown as Tx;

    await expect(nextFormVersionNo('ws1', 'f1', tx)).resolves.toBe(1);
  });

  it('refuses to number a version of a deleted form', async () => {
    const tx = {
      select: jest.fn().mockReturnValueOnce(chain([{ deletedAt: new Date() }])),
    } as unknown as Tx;

    await expect(nextFormVersionNo('ws1', 'f1', tx)).rejects.toThrow('Form not found');
  });

  it('never takes an opened version as the current one', async () => {
    const query = chain([]);
    selectMock.mockReturnValueOnce(query);

    await getCurrentFormVersion('ws1', 'f1');

    expectNoOpened(query);
  });

  it('leaves opened versions out of the picker', async () => {
    const query = chain([]);
    selectMock.mockReturnValueOnce(query);

    await lookupFormVersions({ workspaceIds: ['ws1'], formId: 'f1', limit: 50 });

    expectNoOpened(query);
  });

  it('creates a version opened, under the next version number', async () => {
    const values = jest.fn(() => ({ returning: () => Promise.resolve([{ id: 'v3' }]) }));
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(chain([{ deletedAt: null }]))
        .mockReturnValueOnce(chain([{ versionNo: 2 }])),
      insert: jest.fn(() => ({ values })),
    } as unknown as Tx;

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

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ versionNo: 3, state: 'opened' }));
  });

  // A version nobody has saved yet is not part of the form's history.
  it('lists no opened versions', async () => {
    const page = chain([]);
    txSelectMock.mockReturnValueOnce(page).mockReturnValueOnce(chain([{ total: 0 }]));

    await listFormVersionsForWorkspace({
      workspaceIds: ['ws1'],
      formAccess: { workspaceIds: ['ws1'], overriddenFormIds: [], includedFormIds: [] },
      offset: 0,
      limit: 10,
      formId: 'f1',
      sort: 'versionNo:desc',
    });

    expectNoOpened(page);
  });
});
