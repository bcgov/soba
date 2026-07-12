import { SubmissionService } from '../../../src/core/services/submissionService';
import * as submissionRepo from '../../../src/core/db/repos/submissionRepo';
import * as versionRepo from '../../../src/core/db/repos/formVersionRepo';
import * as formRepo from '../../../src/core/db/repos/formRepo';
import * as registry from '../../../src/core/integrations/form-engine/FormEngineRegistry';

jest.mock('../../../src/core/db/client', () => ({ db: {} }));

jest.mock('../../../src/core/db/repos/submissionRepo', () => ({
  getSubmissionRecordById: jest.fn(),
  updateSubmissionDraft: jest.fn(),
  appendSubmissionRevision: jest.fn(),
  openSubmission: jest.fn(),
  getSubmissionById: jest.fn(),
  listSubmissionsForWorkspace: jest.fn(),
  markSubmissionDeleted: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/formVersionRepo', () => ({
  getFormVersionById: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/formRepo', () => ({
  getFormEngineCodeForForm: jest.fn(),
}));

jest.mock('../../../src/core/integrations/form-engine/FormEngineRegistry', () => ({
  createFormEngineAdapter: jest.fn(),
}));

const getRecord = submissionRepo.getSubmissionRecordById as unknown as jest.Mock;
const updateDraft = submissionRepo.updateSubmissionDraft as unknown as jest.Mock;
const appendRevision = submissionRepo.appendSubmissionRevision as unknown as jest.Mock;
const getVersion = versionRepo.getFormVersionById as unknown as jest.Mock;
const getEngineCode = formRepo.getFormEngineCodeForForm as unknown as jest.Mock;
const createAdapter = registry.createFormEngineAdapter as unknown as jest.Mock;

const input = {
  workspaceId: 'ws1',
  actorId: 'actor-1',
  actorDisplayLabel: 'Filler',
  submissionId: 's1',
  data: { firstName: 'Ada' },
};

const svc = new SubmissionService();

describe('SubmissionService save (versioned engine write)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRecord.mockResolvedValue({
      id: 's1',
      formId: 'f1',
      formVersionId: 'v1',
      currentRevisionNo: 2,
      engineSubmissionRef: 'eng-prev',
      workflowState: 'draft',
      submittedBy: 'actor-1',
    });
    getVersion.mockResolvedValue({ id: 'v1', engineSchemaRef: 'form-ref-1' });
    getEngineCode.mockResolvedValue('formio-v5');
    updateDraft.mockResolvedValue({ id: 's1' });
    appendRevision.mockResolvedValue({ id: 's1', currentRevisionNo: 3 });
  });

  it('creates a new engine submission for the next revision, then appends the revision and returns it', async () => {
    const createSubmission = jest.fn().mockResolvedValue({ engineRef: 'eng-new' });
    createAdapter.mockReturnValue({ createSubmission });

    const result = await svc.submit(input);

    expect(createAdapter).toHaveBeenCalledWith('formio-v5');
    expect(createSubmission).toHaveBeenCalledWith({
      engineFormRef: 'form-ref-1',
      submissionId: 's1',
      revisionNo: 3,
      workspaceId: 'ws1',
      data: { firstName: 'Ada' },
    });
    expect(updateDraft).toHaveBeenCalledWith(
      'ws1',
      's1',
      'Filler',
      expect.objectContaining({ engineSyncStatus: 'provisioning', engineSyncError: null }),
    );
    expect(appendRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: 's1',
        afterEngineSubmissionRef: 'eng-new',
        eventType: 'submitted',
        workflowState: 'submitted',
      }),
    );
    expect(result).toEqual({ id: 's1', currentRevisionNo: 3 });
  });

  it('rejects a submit on a terminal submission without writing to the engine', async () => {
    getRecord.mockResolvedValue({
      id: 's1',
      formId: 'f1',
      formVersionId: 'v1',
      currentRevisionNo: 3,
      engineSubmissionRef: 'eng-prev',
      workflowState: 'submitted',
      submittedBy: 'actor-1',
    });
    const createSubmission = jest.fn();
    createAdapter.mockReturnValue({ createSubmission });

    await expect(svc.submit(input)).rejects.toThrow(/submitted/i);

    expect(createSubmission).not.toHaveBeenCalled();
    expect(updateDraft).not.toHaveBeenCalled();
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('records error status and rethrows when the engine rejects the submission', async () => {
    const createSubmission = jest.fn().mockRejectedValue(new Error('bad data'));
    createAdapter.mockReturnValue({ createSubmission });

    await expect(svc.submit(input)).rejects.toThrow(/bad data/);

    expect(updateDraft).toHaveBeenCalledWith(
      'ws1',
      's1',
      'Filler',
      expect.objectContaining({ engineSyncStatus: 'error', engineSyncError: 'bad data' }),
    );
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the submission is missing', async () => {
    getRecord.mockResolvedValue(null);
    await expect(svc.submit(input)).rejects.toThrow(/not found/i);
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('throws when the form version is not provisioned in the engine', async () => {
    getVersion.mockResolvedValue({ id: 'v1', engineSchemaRef: null });
    await expect(svc.submit(input)).rejects.toThrow(/not provisioned/i);
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('throws when the form has no engine configured', async () => {
    getEngineCode.mockResolvedValue(null);
    await expect(svc.submit(input)).rejects.toThrow(/form engine/i);
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('throws when the engine adapter does not support submissions', async () => {
    createAdapter.mockReturnValue({}); // no createSubmission
    await expect(svc.submit(input)).rejects.toThrow(/does not support/i);
    expect(updateDraft).not.toHaveBeenCalled();
  });
});
