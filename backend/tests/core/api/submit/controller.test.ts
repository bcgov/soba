import express from 'express';
import request from 'supertest';
import type { NextFunction, Request, Response } from 'express';

jest.mock('../../../../src/core/container', () => ({
  submissionsApiService: { get: jest.fn(), getData: jest.fn() },
  formVersionService: { getSchema: jest.fn() },
}));
jest.mock('../../../../src/core/db/repos/submissionParticipantRepo', () => ({
  isActiveParticipant: jest.fn(),
}));
jest.mock('../../../../src/core/db/repos/formSubmitAccessRepo', () => ({
  hasFormSubmitAccess: jest.fn(),
}));
jest.mock('../../../../src/features/form-settings/submitter/drafts', () => ({
  ...jest.requireActual('../../../../src/features/form-settings/submitter/drafts'),
  offersDraftSave: jest.fn(),
}));

import { getSubmitFillBundle } from '../../../../src/core/api/submit/controller';
import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';
import { formVersionService, submissionsApiService } from '../../../../src/core/container';
import { isActiveParticipant } from '../../../../src/core/db/repos/submissionParticipantRepo';
import { hasFormSubmitAccess } from '../../../../src/core/db/repos/formSubmitAccessRepo';
import { offersDraftSave } from '../../../../src/features/form-settings/submitter/drafts';

const getSubmission = submissionsApiService.get as jest.Mock;
const getData = submissionsApiService.getData as jest.Mock;
const getSchema = formVersionService.getSchema as jest.Mock;
const participantMock = jest.mocked(isActiveParticipant);
const formPermissionMock = jest.mocked(hasFormSubmitAccess);
const draftsMock = jest.mocked(offersDraftSave);

function createApp() {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.actorId = 'u1';
    req.user = { providerCode: 'idir', profile: {} } as Express.User;
    req.coreContext = { workspaceId: 'ws1', formId: 'f1' } as Request['coreContext'];
    next();
  });
  app.get('/:id', getSubmitFillBundle);
  app.use(coreErrorHandler);
  return app;
}

beforeEach(() => {
  jest.resetAllMocks();
  getSubmission.mockResolvedValue({
    formId: 'f1',
    formVersionId: 'v1',
    workflowState: 'draft',
    headRevisionId: 'r1',
  });
  getSchema.mockResolvedValue({ components: [] });
  getData.mockResolvedValue({ data: { a: 1 } });
  participantMock.mockResolvedValue(true);
  draftsMock.mockResolvedValue(false);
});

describe('getSubmitFillBundle', () => {
  it('lets a participant who may still submit write', async () => {
    formPermissionMock.mockResolvedValue(true);
    const res = await request(createApp()).get('/s1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ workflowState: 'draft', content: { data: { a: 1 } } });
    expect(res.body.canWrite).toBe(true);
    expect(participantMock).toHaveBeenCalledWith('s1', 'u1');
    expect(formPermissionMock).toHaveBeenCalledWith(
      { workspaceId: 'ws1', formId: 'f1', submissionId: 's1' },
      expect.objectContaining({ actorId: 'u1' }),
      'submission_create',
    );
  });

  it('still serves the bundle, read-only, to a participant who may no longer submit', async () => {
    formPermissionMock.mockResolvedValue(false);
    const res = await request(createApp()).get('/s1');
    expect(res.status).toBe(200);
    expect(res.body.canWrite).toBe(false);
  });

  it('offers a draft save when the caller may write and the form accepts drafts', async () => {
    formPermissionMock.mockResolvedValue(true);
    draftsMock.mockResolvedValue(true);
    const res = await request(createApp()).get('/s1');
    expect(res.body.canSaveDraft).toBe(true);
    expect(draftsMock).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws1' }), 'f1');
  });

  it('withholds a draft save, but still lets the caller submit, when the form offers none', async () => {
    formPermissionMock.mockResolvedValue(true);
    draftsMock.mockResolvedValue(false);
    const res = await request(createApp()).get('/s1');
    expect(res.status).toBe(200);
    expect(res.body.canWrite).toBe(true);
    expect(res.body.canSaveDraft).toBe(false);
  });

  it('withholds a draft save from a caller who may not write', async () => {
    formPermissionMock.mockResolvedValue(false);
    draftsMock.mockResolvedValue(true);
    const res = await request(createApp()).get('/s1');
    expect(res.body.canSaveDraft).toBe(false);
    expect(draftsMock).not.toHaveBeenCalled();
  });
});
