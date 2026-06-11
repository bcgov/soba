import { FormService } from '../../../src/core/services/formService';
import * as formRepo from '../../../src/core/db/repos/formRepo';
import * as versionRepo from '../../../src/core/db/repos/formVersionRepo';
import * as registry from '../../../src/core/integrations/form-engine/FormEngineRegistry';

jest.mock('../../../src/core/db/client', () => ({
  db: { transaction: (cb: (tx: unknown) => unknown) => cb({}) },
}));

jest.mock('../../../src/core/db/repos/formRepo', () => ({
  createForm: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/formVersionRepo', () => ({
  createEmptyFormVersionDraft: jest.fn(),
}));

jest.mock('../../../src/core/integrations/form-engine/FormEngineRegistry', () => ({
  getFormEnginePlugins: jest.fn(() => [{ code: 'formio-v5' }]),
  resolveFormEnginePlugin: jest.fn(),
}));

const createForm = formRepo.createForm as unknown as jest.Mock;
const createDraft = versionRepo.createEmptyFormVersionDraft as unknown as jest.Mock;
const getPlugins = registry.getFormEnginePlugins as unknown as jest.Mock;

const baseCreate = {
  workspaceId: 'ws1',
  actorId: 'a1',
  actorDisplayLabel: 'A',
  slug: 'my-form',
  name: 'My Form',
};

describe('FormService.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPlugins.mockReturnValue([{ code: 'formio-v5' }]);
  });

  it('creates the form and an empty v1 draft in one transaction', async () => {
    createForm.mockResolvedValue({ id: 'f1', name: 'My Form' });
    createDraft.mockResolvedValue({ id: 'v1', formId: 'f1', versionNo: 1, state: 'draft' });

    const svc = new FormService();
    const res = await svc.create({
      workspaceId: 'ws1',
      actorId: 'a1',
      actorDisplayLabel: 'A',
      slug: 'my-form',
      name: 'My Form',
      visibility: ['public'],
    });

    expect(createForm).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'my-form', formEngineCode: 'formio-v5' }),
      expect.anything(),
    );
    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ formId: 'f1', visibility: ['public'] }),
      expect.anything(),
    );
    expect(res).toEqual({
      form: { id: 'f1', name: 'My Form' },
      version: { id: 'v1', formId: 'f1', versionNo: 1, state: 'draft' },
    });
  });

  it('throws when no form engine plugins are installed', async () => {
    getPlugins.mockReturnValue([]);
    const svc = new FormService();
    await expect(svc.create({ ...baseCreate })).rejects.toThrow(/no form engine plugins/i);
    expect(createForm).not.toHaveBeenCalled();
  });

  it('throws when the requested engine is not installed', async () => {
    getPlugins.mockReturnValue([{ code: 'formio-v5' }]);
    const svc = new FormService();
    await expect(svc.create({ ...baseCreate, formEngineCode: 'nope' })).rejects.toThrow(
      /not installed/i,
    );
    expect(createForm).not.toHaveBeenCalled();
  });
});
