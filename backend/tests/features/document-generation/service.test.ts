jest.mock('../../../src/core/db/client', () => ({ db: {} }));

jest.mock('../../../src/core/db/repos/submissionRepo', () => ({
  getSubmissionListContext: jest.fn(),
  getSubmissionRecordById: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/formSubmitAccessRepo', () => ({
  hasFormSubmitAccess: jest.fn(),
}));
jest.mock('../../../src/core/integrations/plugins/PluginRegistry', () => ({
  getDocumentGenerationPluginDefinitions: jest.fn(),
}));
jest.mock('../../../src/core/integrations/document-generation/DocumentGenerationRegistry', () => ({
  resolveDefaultDocumentGenerationCode: jest.fn(),
  createDocumentGenerationAdapter: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/featureRepo', () => ({
  getFeatureGateCached: jest.fn(),
}));
jest.mock('../../../src/core/services/featureAvailabilityService', () => ({
  isFeatureAvailable: jest.fn(),
}));
const getContentMock = jest.fn();
jest.mock('../../../src/core/services/submissionService', () => ({
  SubmissionService: jest.fn().mockImplementation(() => ({ getContent: getContentMock })),
}));
jest.mock('../../../src/core/db/repos/documentGenerationAuditRepo', () => ({
  createDocumentGenerationAudit: jest.fn(),
}));

import { documentGenerationService } from '../../../src/features/document-generation/service';
import * as submissionRepo from '../../../src/core/db/repos/submissionRepo';
import * as accessRepo from '../../../src/core/db/repos/formSubmitAccessRepo';
import * as pluginRegistry from '../../../src/core/integrations/plugins/PluginRegistry';
import * as docgenRegistry from '../../../src/core/integrations/document-generation/DocumentGenerationRegistry';
import * as featureRepo from '../../../src/core/db/repos/featureRepo';
import * as availability from '../../../src/core/services/featureAvailabilityService';
import * as auditRepo from '../../../src/core/db/repos/documentGenerationAuditRepo';
import { ServiceUnavailableError } from '../../../src/core/errors';

const getSubmissionListContext = submissionRepo.getSubmissionListContext as unknown as jest.Mock;
const getSubmissionRecordById = submissionRepo.getSubmissionRecordById as unknown as jest.Mock;
const hasFormSubmitAccess = accessRepo.hasFormSubmitAccess as unknown as jest.Mock;
const getDefs = pluginRegistry.getDocumentGenerationPluginDefinitions as unknown as jest.Mock;
const resolveDefault = docgenRegistry.resolveDefaultDocumentGenerationCode as unknown as jest.Mock;
const createAdapter = docgenRegistry.createDocumentGenerationAdapter as unknown as jest.Mock;
const getFeatureGateCached = featureRepo.getFeatureGateCached as unknown as jest.Mock;
const isFeatureAvailable = availability.isFeatureAvailable as unknown as jest.Mock;
const createAudit = auditRepo.createDocumentGenerationAudit as unknown as jest.Mock;

const caller = { actorId: 'user-1', idpCode: 'idir' };
const scope = { workspaceId: 'ws-1', formId: 'form-1', formVersionId: 'fv-1' };
const renderMock = jest.fn();
const template = { content: 'base64', fileType: 'docx' };

beforeEach(() => {
  jest.clearAllMocks();
  getSubmissionListContext.mockResolvedValue(scope);
  getSubmissionRecordById.mockResolvedValue({ submittedBy: caller.actorId });
  getDefs.mockReturnValue([
    { code: 'cdogs-v2', featureCode: 'document-generation-v2' },
    { code: 'cdogs-v3', featureCode: 'document-generation-v3' },
    { code: 'docgen-noop' },
  ]);
  resolveDefault.mockReturnValue('cdogs-v2');
  getFeatureGateCached.mockImplementation((code: string) =>
    Promise.resolve(
      code === 'document-generation-v3'
        ? { enabled: true, availability: 'scoped' }
        : { enabled: true, availability: 'fixed' },
    ),
  );
  // Default: v2 available everywhere, v3 not granted for this scope.
  isFeatureAvailable.mockImplementation((code: string) =>
    Promise.resolve(code === 'document-generation-v2'),
  );
  renderMock.mockResolvedValue({ data: Buffer.from('doc'), contentType: 'application/pdf' });
  createAdapter.mockReturnValue({ render: renderMock });
  getContentMock.mockResolvedValue({ data: { field: 'saved' } });
  createAudit.mockResolvedValue(undefined);
});

describe('documentGenerationService.preview', () => {
  it('is notfound when the submission does not exist', async () => {
    getSubmissionListContext.mockResolvedValue(null);
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: { field: 'live' },
    });
    expect(outcome.status).toBe('notfound');
  });

  it('is denied without submission_create', async () => {
    hasFormSubmitAccess.mockResolvedValue(false);
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: { field: 'live' },
    });
    expect(outcome.status).toBe('denied');
  });

  it('renders the caller live data via the default backend', async () => {
    hasFormSubmitAccess.mockResolvedValue(true);
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      options: { reportName: 'r' },
      data: { field: 'live' },
    });
    expect(outcome).toMatchObject({ status: 'ok', code: 'cdogs-v2' });
    expect(createAdapter).toHaveBeenCalledWith('cdogs-v2');
    expect(renderMock).toHaveBeenCalledWith({
      template,
      options: { reportName: 'r' },
      data: { field: 'live' },
    });
  });

  it('uses the granted scoped v3 backend over the default', async () => {
    hasFormSubmitAccess.mockResolvedValue(true);
    isFeatureAvailable.mockResolvedValue(true); // v3 now granted for this scope
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: {},
    });
    expect(outcome).toMatchObject({ status: 'ok', code: 'cdogs-v3' });
    expect(createAdapter).toHaveBeenCalledWith('cdogs-v3');
  });

  it('is unavailable when no backend is available for the scope', async () => {
    hasFormSubmitAccess.mockResolvedValue(true);
    isFeatureAvailable.mockResolvedValue(false); // neither v3 nor v2 available
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: {},
    });
    expect(outcome.status).toBe('unavailable');
  });

  it('does not let an available fixed non-default backend override the default', async () => {
    hasFormSubmitAccess.mockResolvedValue(true);
    getDefs.mockReturnValue([
      { code: 'cdogs-v2', featureCode: 'document-generation-v2' },
      { code: 'other-fixed', featureCode: 'other-fixed' },
      { code: 'cdogs-v3', featureCode: 'document-generation-v3' },
      { code: 'docgen-noop' },
    ]);
    // Every feature available except the v3 grant; only a scoped backend may override the default.
    isFeatureAvailable.mockImplementation((code: string) =>
      Promise.resolve(code !== 'document-generation-v3'),
    );
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: {},
    });
    expect(outcome).toMatchObject({ status: 'ok', code: 'cdogs-v2' });
  });

  it('is unavailable when the configured default backend is not installed', async () => {
    hasFormSubmitAccess.mockResolvedValue(true);
    resolveDefault.mockReturnValue('cdogs-v99'); // no such plugin installed
    isFeatureAvailable.mockResolvedValue(false); // and no scoped grant
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: {},
    });
    expect(outcome.status).toBe('unavailable');
  });
});

describe('documentGenerationService.print', () => {
  it('lets staff with submission_read print any submission', async () => {
    getSubmissionRecordById.mockResolvedValue({ submittedBy: 'someone-else' });
    hasFormSubmitAccess.mockImplementation((_w, _c, p) => Promise.resolve(p === 'submission_read'));

    const outcome = await documentGenerationService.print(caller, { submissionId: 's1', template });

    expect(outcome).toMatchObject({ status: 'ok' });
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { data: { field: 'saved' } } }),
    );
  });

  it('lets a submitter print their own submission (no submission_read)', async () => {
    getSubmissionRecordById.mockResolvedValue({ submittedBy: caller.actorId });
    hasFormSubmitAccess.mockImplementation((_w, _c, p) =>
      Promise.resolve(p === 'submission_create'),
    );

    const outcome = await documentGenerationService.print(caller, { submissionId: 's1', template });

    expect(outcome.status).toBe('ok');
  });

  it('denies a non-owner without submission_read', async () => {
    getSubmissionRecordById.mockResolvedValue({ submittedBy: 'someone-else' });
    hasFormSubmitAccess.mockResolvedValue(false);

    const outcome = await documentGenerationService.print(caller, { submissionId: 's1', template });

    expect(outcome.status).toBe('denied');
  });

  it('is no-content when the submission has no persisted data', async () => {
    hasFormSubmitAccess.mockResolvedValue(true);
    getContentMock.mockResolvedValue(null);

    const outcome = await documentGenerationService.print(caller, { submissionId: 's1', template });

    expect(outcome.status).toBe('no-content');
  });
});

describe('documentGenerationService audit', () => {
  it('records a success audit for the backend call', async () => {
    hasFormSubmitAccess.mockResolvedValue(true);

    await documentGenerationService.preview(caller, { submissionId: 's1', template, data: {} });

    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        formId: 'form-1',
        submissionId: 's1',
        mode: 'preview',
        backendCode: 'cdogs-v2',
        outcome: 'success',
        createdBy: 'user-1',
      }),
    );
  });

  it('records an error audit and returns error when the backend throws', async () => {
    hasFormSubmitAccess.mockResolvedValue(true);
    renderMock.mockRejectedValue(new ServiceUnavailableError('CDOGS error 500: boom'));

    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: {},
    });

    expect(outcome.status).toBe('error');
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        backendCode: 'cdogs-v2',
        outcome: 'error',
        httpStatus: 503,
        // PI-safe: the error class, not the upstream body (which was 'CDOGS error 500: boom').
        errorDetail: 'ServiceUnavailableError',
      }),
    );
  });

  it('does not fail the render when the audit write fails', async () => {
    hasFormSubmitAccess.mockResolvedValue(true);
    createAudit.mockRejectedValue(new Error('audit db down'));

    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: {},
    });

    expect(outcome.status).toBe('ok');
  });

  it('does not audit when no backend call is made', async () => {
    // denied: never reaches the backend
    hasFormSubmitAccess.mockResolvedValue(false);
    await documentGenerationService.preview(caller, { submissionId: 's1', template, data: {} });

    // unavailable: no backend resolved
    hasFormSubmitAccess.mockResolvedValue(true);
    isFeatureAvailable.mockResolvedValue(false);
    await documentGenerationService.preview(caller, { submissionId: 's1', template, data: {} });

    // print no-content: no persisted data, so no backend call
    isFeatureAvailable.mockImplementation((code: string) =>
      Promise.resolve(code === 'document-generation-v2'),
    );
    getContentMock.mockResolvedValue(null);
    await documentGenerationService.print(caller, { submissionId: 's1', template });

    expect(createAudit).not.toHaveBeenCalled();
  });
});
