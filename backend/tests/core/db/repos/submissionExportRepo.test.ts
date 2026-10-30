jest.mock('../../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { activeExportsOf, ownExports } from '../../../../src/core/db/repos/submissionExportRepo';

const render = (condition: SQL | undefined) =>
  condition ? new PgDialect().sqlToQuery(condition) : undefined;

// Get, download, stop and the list all read through this, so a person only ever reaches their own
// exports of the form in the path.
describe('ownExports', () => {
  it("names the export job type, the path's form and the caller", () => {
    expect(render(ownExports('form-1', 'actor-1'))).toMatchObject({
      sql: '("soba"."job"."type" = $1 and "soba"."job"."form_id" = $2 and "soba"."job"."created_by" = $3)',
      params: ['submission-export', 'form-1', 'actor-1'],
    });
  });
});

// The limit counts every queued or running export of the form, whoever started it.
describe('activeExportsOf', () => {
  it("counts the form's queued and running exports only", () => {
    expect(render(activeExportsOf('form-1'))).toMatchObject({
      sql: '("soba"."job"."type" = $1 and "soba"."job"."form_id" = $2 and "soba"."job"."status" in ($3, $4))',
      params: ['submission-export', 'form-1', 'queued', 'running'],
    });
  });
});
