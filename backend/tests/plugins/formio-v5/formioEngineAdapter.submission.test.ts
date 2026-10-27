import {
  FormioEngineAdapter,
  buildSubmissionBody,
} from '../../../src/plugins/formio-v5/formioEngineAdapter';
import type { PluginConfigReader } from '../../../src/core/config/pluginConfig';
import {
  FormioApiError,
  getAuthenticatedFormioClient,
} from '../../../src/plugins/formio-v5/formioV5Client';
import { InternalError, ValidationError } from '../../../src/core/errors';

jest.mock('../../../src/plugins/formio-v5/formioV5Client', () => ({
  ...jest.requireActual('../../../src/plugins/formio-v5/formioV5Client'),
  getAuthenticatedFormioClient: jest.fn(),
}));

const mockedGetClient = getAuthenticatedFormioClient as unknown as jest.Mock;

function makeConfig(): PluginConfigReader {
  return {
    getRequired: (key: string) => `val-${key}`,
    getOptional: () => undefined,
  } as unknown as PluginConfigReader;
}

interface FakeClient {
  loadForm: jest.Mock;
  loadSubmissions: jest.Mock;
  loadSubmission: jest.Mock;
  saveSubmission: jest.Mock;
  deleteSubmission: jest.Mock;
}

function makeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  return {
    loadForm: jest.fn().mockResolvedValue({ _id: 'form-ref-1', components: [] }),
    loadSubmissions: jest.fn().mockResolvedValue([]),
    loadSubmission: jest.fn().mockResolvedValue({ _id: 'sub-1', data: { a: 1 } }),
    saveSubmission: jest.fn().mockResolvedValue({ _id: 'sub-new' }),
    deleteSubmission: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const createInput = {
  engineFormRef: 'form-ref-1',
  submissionId: 's1',
  revisionId: 'rev-3',
  workspaceId: 'ws1',
  data: { firstName: 'Ada' },
  validate: true,
};

describe('FormioEngineAdapter submission methods', () => {
  beforeEach(() => jest.clearAllMocks());

  it('buildSubmissionBody keeps answers clean in data and puts the correlation key in metadata', () => {
    const body = buildSubmissionBody(createInput);
    // Form.io strips non-component data keys, so the correlation key must NOT be in data.
    expect(body.data).toEqual({ firstName: 'Ada' });
    expect(body.metadata).toEqual({
      soba_workspace_id: 'ws1',
      soba_submission_id: 's1',
      soba_revision_id: 'rev-3',
    });
  });

  it('buildSubmissionBody does not mutate the input data', () => {
    const data = { firstName: 'Ada' };
    buildSubmissionBody({ ...createInput, data });
    expect(data).toEqual({ firstName: 'Ada' });
  });

  it('creates a new submission document and returns its engine ref', async () => {
    const client = makeClient({
      loadSubmissions: jest.fn().mockResolvedValue([]),
      saveSubmission: jest.fn().mockResolvedValue({ _id: 'sub-new' }),
    });
    mockedGetClient.mockResolvedValue(client);

    const adapter = new FormioEngineAdapter(makeConfig());
    const res = await adapter.createSubmission(createInput);

    expect(res).toEqual({ engineRef: 'sub-new' });
    expect(client.loadSubmissions).toHaveBeenCalledWith('form-ref-1', {
      params: { 'metadata.soba_revision_id': 'rev-3' },
    });
    const body = client.saveSubmission.mock.calls[0][1] as Record<string, unknown>;
    expect(body._id).toBeUndefined(); // POST (new doc), not PUT
  });

  it.each([
    [true, undefined],
    [false, { params: { noValidate: true } }],
  ])('with validate %s saves with query %j', async (validate, query) => {
    const client = makeClient();
    mockedGetClient.mockResolvedValue(client);

    await new FormioEngineAdapter(makeConfig()).createSubmission({ ...createInput, validate });

    expect(client.saveSubmission).toHaveBeenCalledWith('form-ref-1', expect.any(Object), query);
  });

  it('is idempotent: a retry for the same revision returns the existing doc without re-saving', async () => {
    const client = makeClient({
      loadSubmissions: jest.fn().mockResolvedValue([{ _id: 'sub-existing' }]),
    });
    mockedGetClient.mockResolvedValue(client);

    const adapter = new FormioEngineAdapter(makeConfig());
    const res = await adapter.createSubmission(createInput);

    expect(res).toEqual({ engineRef: 'sub-existing' });
    expect(client.saveSubmission).not.toHaveBeenCalled();
  });

  it('maps a Form.io 4xx rejection to a coded ValidationError about the data', async () => {
    const rejected = Object.assign(new Error('invalid submission'), { status: 400 });
    const client = makeClient({ saveSubmission: jest.fn().mockRejectedValue(rejected) });
    mockedGetClient.mockResolvedValue(client);

    const adapter = new FormioEngineAdapter(makeConfig());
    const created = adapter.createSubmission(createInput);
    await expect(created).rejects.toBeInstanceOf(ValidationError);
    await expect(created).rejects.toMatchObject({
      code: 'engine_data_rejected',
      message: 'Form engine rejected the submission data: invalid submission',
    });
  });

  it('throws when no admin client is available', async () => {
    mockedGetClient.mockResolvedValue(null);
    const adapter = new FormioEngineAdapter(makeConfig());
    await expect(adapter.createSubmission(createInput)).rejects.toThrow(/admin client/i);
  });

  it('readSubmission strips engine-managed fields and the SOBA metadata', async () => {
    const client = makeClient({
      loadSubmission: jest.fn().mockResolvedValue({
        _id: 'sub-1',
        owner: 'o',
        created: 'c',
        data: { firstName: 'Ada' },
        metadata: { soba_revision_id: 'rev-3', headers: { host: 'x' } },
      }),
    });
    mockedGetClient.mockResolvedValue(client);

    const adapter = new FormioEngineAdapter(makeConfig());
    const result = await adapter.readSubmission('form-ref-1', 'sub-1');

    expect(client.loadSubmission).toHaveBeenCalledWith('form-ref-1', 'sub-1');
    expect(result).toEqual({ data: { firstName: 'Ada' } });
  });

  it('readSubmission returns null when the document is not found', async () => {
    const client = makeClient({ loadSubmission: jest.fn().mockResolvedValue(null) });
    mockedGetClient.mockResolvedValue(client);
    const adapter = new FormioEngineAdapter(makeConfig());
    expect(await adapter.readSubmission('form-ref-1', 'missing')).toBeNull();
  });

  const resourceNotFound = () =>
    new FormioApiError(400, 'Error: Resource not found', 'http://formio.test/form/x');

  it.each([
    ['400 Resource not found', resourceNotFound()],
    ['404', new FormioApiError(404, 'Not Found', 'http://formio.test/form/x')],
  ])(
    'fails a read of a missing document with engine_document_missing on %s',
    async (_label, missing) => {
      const client = makeClient({
        loadForm: jest.fn().mockRejectedValue(missing),
        loadSubmission: jest.fn().mockRejectedValue(missing),
      });
      mockedGetClient.mockResolvedValue(client);
      const adapter = new FormioEngineAdapter(makeConfig());
      const engineDocumentMissing = { statusCode: 500, code: 'engine_document_missing' };
      await expect(adapter.readSchema('missing')).rejects.toBeInstanceOf(InternalError);
      await expect(adapter.readSchema('missing')).rejects.toMatchObject(engineDocumentMissing);
      await expect(adapter.readSubmission('form-ref-1', 'missing')).rejects.toMatchObject(
        engineDocumentMissing,
      );
    },
  );

  it.each([
    [
      'a 400 for another reason',
      new FormioApiError(400, 'Error: Invalid id', 'http://formio.test'),
    ],
    ['a 500', new FormioApiError(500, 'boom', 'http://formio.test')],
  ])('still throws a read failure that is %s', async (_label, failure) => {
    const client = makeClient({
      loadForm: jest.fn().mockRejectedValue(failure),
      loadSubmission: jest.fn().mockRejectedValue(failure),
    });
    mockedGetClient.mockResolvedValue(client);
    const adapter = new FormioEngineAdapter(makeConfig());
    await expect(adapter.readSchema('form-ref-1')).rejects.toBe(failure);
    await expect(adapter.readSubmission('form-ref-1', 'sub-1')).rejects.toBe(failure);
  });

  it('deleteSubmission deletes the document under its form', async () => {
    const client = makeClient();
    mockedGetClient.mockResolvedValue(client);

    const adapter = new FormioEngineAdapter(makeConfig());
    await adapter.deleteSubmission('form-ref-1', 'sub-1');

    expect(client.deleteSubmission).toHaveBeenCalledWith('form-ref-1', 'sub-1');
  });

  it('deleteSubmission throws when no admin client is available', async () => {
    mockedGetClient.mockResolvedValue(null);
    const adapter = new FormioEngineAdapter(makeConfig());
    await expect(adapter.deleteSubmission('form-ref-1', 'sub-1')).rejects.toThrow(/admin client/i);
  });
});
