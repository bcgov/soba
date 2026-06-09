import { FormioEngineAdapter } from '../../../src/plugins/formio-v5/formioEngineAdapter';
import type { PluginConfigReader } from '../../../src/core/config/pluginConfig';
import { getAuthenticatedFormioClient } from '../../../src/plugins/formio-v5/formioV5Client';

jest.mock('../../../src/plugins/formio-v5/formioV5Client', () => ({
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
  loadForms: jest.Mock;
  loadForm: jest.Mock;
  saveForm: jest.Mock;
  deleteForm: jest.Mock;
}

function makeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  return {
    loadForms: jest.fn().mockResolvedValue([]),
    loadForm: jest.fn().mockResolvedValue({ _id: 'ref', name: 'soba-x' }),
    saveForm: jest.fn().mockResolvedValue({ _id: 'new-id' }),
    deleteForm: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('FormioEngineAdapter schema methods', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates (POST) a new document when none exists, with deterministic identity + tenancy metadata', async () => {
    const client = makeClient({
      loadForms: jest.fn().mockResolvedValue([]),
      saveForm: jest.fn().mockResolvedValue({ _id: 'new-id' }),
    });
    mockedGetClient.mockResolvedValue(client);

    const adapter = new FormioEngineAdapter(makeConfig());
    const res = await adapter.upsertSchema({
      formVersionId: 'v1',
      workspaceId: 'ws1',
      schema: { components: [] },
    });

    expect(res).toEqual({ engineRef: 'new-id' });
    expect(client.loadForms).toHaveBeenCalledWith({ params: { name: 'soba-v1' } });

    const body = client.saveForm.mock.calls[0][0] as Record<string, unknown>;
    expect(body._id).toBeUndefined(); // POST path, not PUT
    expect(body.name).toBe('soba-v1');
    expect(body.path).toBe('soba-v1');
    expect(body.tags).toEqual(expect.arrayContaining(['soba', 'ws1']));
    const props = body.properties as Record<string, unknown>;
    expect(props.soba_workspace_id).toBe('ws1');
    expect(props.soba_form_version_id).toBe('v1');
  });

  it('updates (PUT) the existing document on retry — idempotent, no duplicate', async () => {
    const client = makeClient({
      loadForms: jest.fn().mockResolvedValue([{ _id: 'abc' }]),
      saveForm: jest.fn().mockResolvedValue({ _id: 'abc' }),
    });
    mockedGetClient.mockResolvedValue(client);

    const adapter = new FormioEngineAdapter(makeConfig());
    const res = await adapter.upsertSchema({ formVersionId: 'v1', workspaceId: 'ws1', schema: {} });

    expect(res).toEqual({ engineRef: 'abc' });
    const body = client.saveForm.mock.calls[0][0] as Record<string, unknown>;
    expect(body._id).toBe('abc'); // PUT path
  });

  it('throws when no admin client is available', async () => {
    mockedGetClient.mockResolvedValue(null);
    const adapter = new FormioEngineAdapter(makeConfig());
    await expect(
      adapter.upsertSchema({ formVersionId: 'v1', workspaceId: 'ws1', schema: {} }),
    ).rejects.toThrow(/admin client/i);
  });

  it('throws when saveForm returns no _id', async () => {
    const client = makeClient({ saveForm: jest.fn().mockResolvedValue({}) });
    mockedGetClient.mockResolvedValue(client);
    const adapter = new FormioEngineAdapter(makeConfig());
    await expect(
      adapter.upsertSchema({ formVersionId: 'v1', workspaceId: 'ws1', schema: {} }),
    ).rejects.toThrow(/_id/i);
  });

  it('reads the document by ref', async () => {
    const client = makeClient();
    mockedGetClient.mockResolvedValue(client);
    const adapter = new FormioEngineAdapter(makeConfig());
    await adapter.readSchema('ref1');
    expect(client.loadForm).toHaveBeenCalledWith('ref1');
  });

  it('deletes the document by ref', async () => {
    const client = makeClient();
    mockedGetClient.mockResolvedValue(client);
    const adapter = new FormioEngineAdapter(makeConfig());
    await adapter.deleteSchema('ref2');
    expect(client.deleteForm).toHaveBeenCalledWith('ref2');
  });
});
