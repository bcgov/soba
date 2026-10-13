jest.mock('../../../src/core/db/client', () => ({ db: {} }));

jest.mock('../../../src/core/db/repos/submissionRepo', () => ({
  getSubmissionListContext: jest.fn(),
  getSubmissionRecordById: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/submissionParticipantRepo', () => ({
  isActiveParticipant: jest.fn(),
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
import * as participantRepo from '../../../src/core/db/repos/submissionParticipantRepo';
import * as accessRepo from '../../../src/core/db/repos/formSubmitAccessRepo';
import * as pluginRegistry from '../../../src/core/integrations/plugins/PluginRegistry';
import * as docgenRegistry from '../../../src/core/integrations/document-generation/DocumentGenerationRegistry';
import * as featureRepo from '../../../src/core/db/repos/featureRepo';
import * as availability from '../../../src/core/services/featureAvailabilityService';
import * as auditRepo from '../../../src/core/db/repos/documentGenerationAuditRepo';
import { ServiceUnavailableError } from '../../../src/core/errors';

const getSubmissionListContext = submissionRepo.getSubmissionListContext as unknown as jest.Mock;
const getSubmissionRecordById = submissionRepo.getSubmissionRecordById as unknown as jest.Mock;
const isActiveParticipant = participantRepo.isActiveParticipant as unknown as jest.Mock;
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
  getSubmissionRecordById.mockResolvedValue({ id: 's1' });
  hasFormSubmitAccess.mockResolvedValue(false);
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

  it('is denied to a caller who is not a participant, whatever their form permissions', async () => {
    isActiveParticipant.mockResolvedValue(false);
    hasFormSubmitAccess.mockResolvedValue(true);
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: { field: 'live' },
    });
    expect(outcome.status).toBe('denied');
  });

  it('renders the caller live data via the default backend', async () => {
    isActiveParticipant.mockResolvedValue(true);
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      options: { reportName: 'r' },
      data: { field: 'live' },
    });
    expect(outcome).toMatchObject({ status: 'ok', code: 'cdogs-v2' });
    expect(isActiveParticipant).toHaveBeenCalledWith('s1', caller.actorId);
    expect(createAdapter).toHaveBeenCalledWith('cdogs-v2');
    // Service passes the payload through untouched; CDOGS-specific shaping is in the plugin.
    expect(renderMock).toHaveBeenCalledWith({
      template,
      options: { reportName: 'r' },
      data: { field: 'live' },
    });
  });

  it('uses the granted scoped v3 backend over the default', async () => {
    isActiveParticipant.mockResolvedValue(true);
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
    isActiveParticipant.mockResolvedValue(true);
    isFeatureAvailable.mockResolvedValue(false); // neither v3 nor v2 available
    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: {},
    });
    expect(outcome.status).toBe('unavailable');
  });

  it('does not let an available fixed non-default backend override the default', async () => {
    isActiveParticipant.mockResolvedValue(true);
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
    isActiveParticipant.mockResolvedValue(true);
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
  it('lets a participant print the persisted submission', async () => {
    isActiveParticipant.mockResolvedValue(true);

    const outcome = await documentGenerationService.print(caller, { submissionId: 's1', template });

    expect(outcome).toMatchObject({ status: 'ok' });
    expect(isActiveParticipant).toHaveBeenCalledWith('s1', caller.actorId);
    // Service passes the raw persisted doc through; the plugin flattens it for the template.
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { data: { field: 'saved' } } }),
    );
  });

  it('denies a caller who is not a participant, whatever their form permissions', async () => {
    isActiveParticipant.mockResolvedValue(false);
    hasFormSubmitAccess.mockResolvedValue(true);

    const outcome = await documentGenerationService.print(caller, { submissionId: 's1', template });

    expect(outcome.status).toBe('denied');
  });

  it('is no-content when the submission has no persisted data', async () => {
    isActiveParticipant.mockResolvedValue(true);
    getContentMock.mockResolvedValue(null);

    const outcome = await documentGenerationService.print(caller, { submissionId: 's1', template });

    expect(outcome.status).toBe('no-content');
  });
});

describe('documentGenerationService audit', () => {
  it('records a success audit for the backend call', async () => {
    isActiveParticipant.mockResolvedValue(true);

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
    isActiveParticipant.mockResolvedValue(true);
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

  it('audits and returns a 503 when the backend fails to construct (misconfigured)', async () => {
    isActiveParticipant.mockResolvedValue(true);
    // A granted-but-unconfigured backend throws a plain Error during construction.
    createAdapter.mockImplementation(() => {
      throw new Error('PLUGIN_CDOGS_V3_ENDPOINT is required');
    });

    const outcome = await documentGenerationService.preview(caller, {
      submissionId: 's1',
      template,
      data: {},
    });

    expect(outcome.status).toBe('error');
    expect((outcome as { error: unknown }).error).toBeInstanceOf(ServiceUnavailableError);
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'error',
        httpStatus: 503,
        errorDetail: 'ServiceUnavailableError',
      }),
    );
  });

  it('does not fail the render when the audit write fails', async () => {
    isActiveParticipant.mockResolvedValue(true);
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
    isActiveParticipant.mockResolvedValue(false);
    await documentGenerationService.preview(caller, { submissionId: 's1', template, data: {} });

    // unavailable: no backend resolved
    isActiveParticipant.mockResolvedValue(true);
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
