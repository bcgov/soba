jest.mock('../../../../src/core/db/client', () => ({ quietDb: {} }));

import { childRow, type ChildJob } from '../../../../src/core/db/repos/jobRepo';

const parent = { id: 'parent-job', workspaceId: 'ws1' };
const child: ChildJob = {
  type: 'post-submission-log',
  formId: 'f1',
  submissionId: 's1',
  createdBy: 'actor-1',
  params: { n: 1 },
  dedupeKey: 'post-submission-log:r1',
  maxAttempts: 3,
};

describe('childRow', () => {
  it("puts the child in its parent's workspace, under its parent", () => {
    expect(childRow(parent, child)).toEqual({
      ...child,
      workspaceId: 'ws1',
      parentJobId: 'parent-job',
    });
  });
});
