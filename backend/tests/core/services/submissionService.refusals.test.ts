import { SubmissionService } from '../../../src/core/services/submissionService';
import * as submissionRepo from '../../../src/core/db/repos/submissionRepo';
import * as versionRepo from '../../../src/core/db/repos/formVersionRepo';
import { ConflictError, NotFoundError } from '../../../src/core/errors';

jest.mock('../../../src/core/db/client', () => ({ db: {} }));

jest.mock('../../../src/core/db/repos/submissionRepo', () => ({
  openSubmission: jest.fn(),
  markSubmissionDeleted: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/formVersionRepo', () => ({
  getPublishedVersionForForm: jest.fn(),
}));

const markDeleted = jest.mocked(submissionRepo.markSubmissionDeleted);
const getPublished = jest.mocked(versionRepo.getPublishedVersionForForm);

const svc = new SubmissionService();
const ctx = { workspaceId: 'ws1', actorId: 'u1', actorDisplayLabel: 'Filler' };

// The routes decide these first; the service refuses the same way when the state changes in between.
describe('SubmissionService refusals carry the route codes', () => {
  beforeEach(() => jest.resetAllMocks());

  it('refuses an open once the form has no published version with not_published', async () => {
    getPublished.mockResolvedValue(null);
    const refused = svc.open({ ...ctx, id: 's1', formId: 'f1' });
    await expect(refused).rejects.toBeInstanceOf(NotFoundError);
    await expect(refused).rejects.toMatchObject({ code: 'not_published' });
  });

  it('refuses a delete of a submission submitted in the meantime with delete_closed', async () => {
    markDeleted.mockResolvedValue({
      outcome: 'not_deletable',
      workflowState: 'submitted',
    } as never);
    const refused = svc.deleteUnsubmitted({ ...ctx, submissionId: 's1' });
    await expect(refused).rejects.toBeInstanceOf(ConflictError);
    await expect(refused).rejects.toMatchObject({ code: 'delete_closed' });
  });
});
