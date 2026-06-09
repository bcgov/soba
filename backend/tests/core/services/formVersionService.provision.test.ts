import { FormVersionService } from '../../../src/core/services/formVersionService';
import * as versionRepo from '../../../src/core/db/repos/formVersionRepo';
import * as formRepo from '../../../src/core/db/repos/formRepo';
import * as registry from '../../../src/core/integrations/form-engine/FormEngineRegistry';

jest.mock('../../../src/core/db/client', () => ({ db: {} }));

jest.mock('../../../src/core/db/repos/formVersionRepo', () => ({
  getFormVersionById: jest.fn(),
  updateFormVersionDraft: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/formRepo', () => ({
  getFormById: jest.fn(),
  getFormEngineCodeForForm: jest.fn(),
}));

jest.mock('../../../src/core/integrations/form-engine/FormEngineRegistry', () => ({
  createFormEngineAdapter: jest.fn(),
}));

const getById = versionRepo.getFormVersionById as unknown as jest.Mock;
const updateDraft = versionRepo.updateFormVersionDraft as unknown as jest.Mock;
const getFormById = formRepo.getFormById as unknown as jest.Mock;
const getEngineCode = formRepo.getFormEngineCodeForForm as unknown as jest.Mock;
const createAdapter = registry.createFormEngineAdapter as unknown as jest.Mock;

const actor = {
  workspaceId: 'ws1',
  actorId: 'actor-1',
  actorDisplayLabel: 'Author',
  formVersionId: 'v1',
};
const schema = { components: [] };

const svc = new FormVersionService();

describe('FormVersionService provision/getSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateDraft.mockResolvedValue({ id: 'v1' });
    getFormById.mockResolvedValue({ id: 'f1', name: 'My Form' });
    getEngineCode.mockResolvedValue('formio-v5');
  });

  it('provision: provisions then marks ready with the engine ref', async () => {
    getById.mockResolvedValue({ id: 'v1', formId: 'f1', engineSchemaRef: null });
    const upsertSchema = jest.fn().mockResolvedValue({ engineRef: 'eng-1' });
    createAdapter.mockReturnValue({ upsertSchema });

    await svc.provision({ ...actor, schema });

    expect(createAdapter).toHaveBeenCalledWith('formio-v5');
    expect(upsertSchema).toHaveBeenCalledWith({
      formVersionId: 'v1',
      workspaceId: 'ws1',
      schema,
      title: 'My Form',
    });
    expect(updateDraft).toHaveBeenCalledWith(
      'ws1',
      'v1',
      'Author',
      expect.objectContaining({ engineSyncStatus: 'provisioning' }),
    );
    expect(updateDraft).toHaveBeenCalledWith(
      'ws1',
      'v1',
      'Author',
      expect.objectContaining({
        engineSchemaRef: 'eng-1',
        engineSyncStatus: 'ready',
        engineSyncError: null,
      }),
    );
  });

  it('provision: on engine reject, records error status and rethrows', async () => {
    getById.mockResolvedValue({ id: 'v1', formId: 'f1', engineSchemaRef: null });
    const upsertSchema = jest.fn().mockRejectedValue(new Error('bad schema'));
    createAdapter.mockReturnValue({ upsertSchema });

    await expect(svc.provision({ ...actor, schema })).rejects.toThrow(/bad schema/);

    expect(updateDraft).toHaveBeenCalledWith(
      'ws1',
      'v1',
      'Author',
      expect.objectContaining({ engineSyncStatus: 'error', engineSyncError: 'bad schema' }),
    );
  });

  it('provision: rejects when the form has no engine configured', async () => {
    getById.mockResolvedValue({ id: 'v1', formId: 'f1', engineSchemaRef: null });
    getEngineCode.mockResolvedValue(null);

    await expect(svc.provision({ ...actor, schema })).rejects.toThrow(/form engine/i);
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('getSchema: reads from the engine by ref', async () => {
    getById.mockResolvedValue({ id: 'v1', formId: 'f1', engineSchemaRef: 'eng-1' });
    const readSchema = jest.fn().mockResolvedValue({ components: ['x'] });
    createAdapter.mockReturnValue({ readSchema });

    const result = await svc.getSchema({ workspaceId: 'ws1', formVersionId: 'v1' });

    expect(readSchema).toHaveBeenCalledWith('eng-1');
    expect(result).toEqual({ components: ['x'] });
  });

  it('getSchema: returns null when the version has no engine ref', async () => {
    getById.mockResolvedValue({ id: 'v1', formId: 'f1', engineSchemaRef: null });

    const result = await svc.getSchema({ workspaceId: 'ws1', formVersionId: 'v1' });

    expect(result).toBeNull();
    expect(createAdapter).not.toHaveBeenCalled();
  });

  it('provision: throws NotFoundError when the version is missing', async () => {
    getById.mockResolvedValue(null);
    await expect(svc.provision({ ...actor, schema })).rejects.toThrow(/not found/i);
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('provision: throws when the engine adapter does not support provisioning', async () => {
    getById.mockResolvedValue({ id: 'v1', formId: 'f1', engineSchemaRef: null });
    createAdapter.mockReturnValue({}); // adapter without upsertSchema
    await expect(svc.provision({ ...actor, schema })).rejects.toThrow(/does not support/i);
    expect(updateDraft).not.toHaveBeenCalled();
  });
});
