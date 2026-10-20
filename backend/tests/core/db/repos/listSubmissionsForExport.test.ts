import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

// Captures the query the repo builds, so its filters can be read as SQL without a database.
const captured: { where?: SQL; orderBy?: SQL[] } = {};
const chain = {
  from: () => chain,
  innerJoin: () => chain,
  leftJoin: () => chain,
  where: (where: SQL) => {
    captured.where = where;
    return chain;
  },
  orderBy: (...orderBy: SQL[]) => {
    captured.orderBy = orderBy;
    return Promise.resolve([]);
  },
};

jest.mock('../../../../src/core/db/client', () => ({ db: { select: () => chain } }));

import { listSubmissionsForExport } from '../../../../src/core/db/repos/submissionRepo';

const dialect = new PgDialect();
const whereSql = () => dialect.sqlToQuery(captured.where!);

const base = { workspaceId: 'ws1', formId: 'f1', includeDrafts: false };

describe('listSubmissionsForExport', () => {
  it('reads live submitted submissions of the form, in every version', async () => {
    await listSubmissionsForExport(base);

    const { sql, params } = whereSql();
    expect(params).toEqual(['ws1', 'f1', 'submitted']);
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).not.toContain('"form_version_id" =');
  });

  it('adds drafts, one version and inclusive date bounds at millisecond precision', async () => {
    await listSubmissionsForExport({
      ...base,
      includeDrafts: true,
      formVersionId: 'v2',
      from: new Date('2026-10-01T00:00:00.001Z'),
      to: new Date('2026-10-19T12:00:00.000Z'),
    });

    const { sql, params } = whereSql();
    expect(params).toEqual([
      'ws1',
      'f1',
      'submitted',
      'draft',
      'v2',
      '2026-10-01T00:00:00.001Z',
      '2026-10-19T12:00:00.000Z',
    ]);
    expect(sql).toContain(
      `date_trunc('milliseconds', coalesce("soba"."submission"."submitted_at", "soba"."submission"."updated_at")) >= $6`,
    );
    expect(sql).toContain(') <= $7');
  });

  it('orders newest first', async () => {
    await listSubmissionsForExport(base);

    expect(dialect.sqlToQuery(captured.orderBy![0]).sql).toMatch(/\) desc$/);
  });
});
