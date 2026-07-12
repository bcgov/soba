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
const getVersion = versionRepo.getFormVersionById as unknown as jest.Mock;
const getEngineCode = formRepo.getFormEngineCodeForForm as unknown as jest.Mock;
const createAdapter = registry.createFormEngineAdapter as unknown as jest.Mock;

const svc = new SubmissionService();
const args = { workspaceId: 'ws1', submissionId: 's1' };

describe('SubmissionService getContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRecord.mockResolvedValue({
      id: 's1',
      formId: 'f1',
      formVersionId: 'v1',
      engineSubmissionRef: 'sub-ref-1',
    });
    getVersion.mockResolvedValue({ id: 'v1', engineSchemaRef: 'form-ref-1' });
    getEngineCode.mockResolvedValue('formio-v5');
  });

  it('reads the submission content from the engine by form ref + submission ref', async () => {
    const readSubmission = jest.fn().mockResolvedValue({ data: { firstName: 'Ada' } });
    createAdapter.mockReturnValue({ readSubmission });

    const result = await svc.getContent(args);

    expect(readSubmission).toHaveBeenCalledWith('form-ref-1', 'sub-ref-1');
    expect(result).toEqual({ data: { firstName: 'Ada' } });
  });

  it('returns null when the submission is missing', async () => {
    getRecord.mockResolvedValue(null);
    expect(await svc.getContent(args)).toBeNull();
    expect(createAdapter).not.toHaveBeenCalled();
  });

  it('returns null when the submission has no engine ref', async () => {
    getRecord.mockResolvedValue({
      id: 's1',
      formId: 'f1',
      formVersionId: 'v1',
      engineSubmissionRef: null,
    });
    expect(await svc.getContent(args)).toBeNull();
    expect(createAdapter).not.toHaveBeenCalled();
  });

  it('returns null when the form version is not provisioned', async () => {
    getVersion.mockResolvedValue({ id: 'v1', engineSchemaRef: null });
    expect(await svc.getContent(args)).toBeNull();
    expect(createAdapter).not.toHaveBeenCalled();
  });

  it('returns null when the form has no engine configured', async () => {
    getEngineCode.mockResolvedValue(null);
    expect(await svc.getContent(args)).toBeNull();
    expect(createAdapter).not.toHaveBeenCalled();
  });

  it('returns null when the engine adapter does not support reading submissions', async () => {
    createAdapter.mockReturnValue({}); // no readSubmission
    expect(await svc.getContent(args)).toBeNull();
  });
});
