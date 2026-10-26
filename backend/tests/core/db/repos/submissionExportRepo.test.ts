import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

// Captures the queries the repo builds, so they can be read as SQL without a database.
const captured: { where?: SQL; orderBy?: SQL; limit?: number; values?: unknown } = {};
const mockRows: unknown[] = [];
const chain = {
  from: () => chain,
  where: (where: SQL) => {
    captured.where = where;
    return chain;
  },
  orderBy: (orderBy: SQL) => {
    captured.orderBy = orderBy;
    return chain;
  },
  limit: (limit: number) => {
    captured.limit = limit;
    return Promise.resolve(mockRows);
  },
};

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: () => chain,
    insert: () => ({
      values: (values: unknown) => {
        captured.values = values;
        return Promise.resolve();
      },
    }),
  },
}));

import {
  getLastExportToDate,
  recordSubmissionExport,
} from '../../../../src/core/db/repos/submissionExportRepo';

const dialect = new PgDialect();

describe('submissionExportRepo', () => {
  beforeEach(() => {
    mockRows.length = 0;
  });

  it("reads the upper bound of the person's latest export of the form", async () => {
    const toDate = new Date('2026-10-19T12:00:00.000Z');
    mockRows.push({ toDate });

    await expect(getLastExportToDate('f1', 'u1')).resolves.toEqual(toDate);

    expect(dialect.sqlToQuery(captured.where!).params).toEqual(['f1', 'u1']);
    expect(dialect.sqlToQuery(captured.orderBy!).sql).toMatch(/"created_at" desc$/);
    expect(captured.limit).toBe(1);
  });

  it('answers null when the person never exported the form', async () => {
    await expect(getLastExportToDate('f1', 'u1')).resolves.toBeNull();
  });

  it('records an export', async () => {
    const input = {
      workspaceId: 'ws1',
      formId: 'f1',
      exportedBy: 'u1',
      toDate: new Date('2026-10-19T12:00:00.000Z'),
    };

    await recordSubmissionExport(input);

    expect(captured.values).toEqual(input);
  });
});
