jest.mock('../../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { packageJobOf } from '../../../../src/core/db/repos/submissionPackageRepo';

const render = (condition: SQL | undefined) =>
  condition ? new PgDialect().sqlToQuery(condition) : undefined;

// A download link opens a package only through this, so a job of another submission, workspace or
// type is never served.
describe('packageJobOf', () => {
  it("names the job, the submission's workspace, the submission and the package job type", () => {
    expect(render(packageJobOf('ws-1', 'sub-1', 'job-1'))).toMatchObject({
      sql: '("soba"."job"."id" = $1 and "soba"."job"."workspace_id" = $2 and "soba"."job"."submission_id" = $3 and "soba"."job"."type" = $4)',
      params: ['job-1', 'ws-1', 'sub-1', 'post-submission-email-package'],
    });
  });
});
