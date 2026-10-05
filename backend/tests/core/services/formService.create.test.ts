import { FormService } from '../../../src/core/services/formService';
import * as formRepo from '../../../src/core/db/repos/formRepo';
import * as versionRepo from '../../../src/core/db/repos/formVersionRepo';
import * as registry from '../../../src/core/integrations/form-engine/FormEngineRegistry';
import * as workspaceRepo from '../../../src/core/db/repos/workspaceRepo';
import * as formSettings from '../../../src/features/form-settings/create';

jest.mock('../../../src/core/db/client', () => ({
  db: { transaction: (cb: (tx: unknown) => unknown) => cb({}) },
}));

jest.mock('../../../src/core/db/repos/formRepo', () => ({
  createForm: jest.fn(),
  formNameExistsInWorkspace: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/formVersionRepo', () => ({
  createEmptyFormVersionDraft: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/workspaceRepo', () => ({
  isWorkspaceDisclaimerAccepted: jest.fn(),
}));

jest.mock('../../../src/features/form-settings/create', () => ({
  createFormSettings: jest.fn(),
}));

jest.mock('../../../src/core/integrations/form-engine/FormEngineRegistry', () => ({
  getFormEnginePlugins: jest.fn(() => [{ code: 'formio-v5' }]),
  resolveFormEnginePlugin: jest.fn(),
}));

const createForm = formRepo.createForm as unknown as jest.Mock;
const nameExists = formRepo.formNameExistsInWorkspace as unknown as jest.Mock;
const disclaimerAccepted = workspaceRepo.isWorkspaceDisclaimerAccepted as unknown as jest.Mock;
const createDraft = versionRepo.createEmptyFormVersionDraft as unknown as jest.Mock;
const getPlugins = registry.getFormEnginePlugins as unknown as jest.Mock;
const createSettings = formSettings.createFormSettings as unknown as jest.Mock;

const baseCreate = {
  workspaceId: 'ws1',
  actorId: 'a1',
  actorDisplayLabel: 'A',
  name: 'My Form',
};

describe('FormService.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPlugins.mockReturnValue([{ code: 'formio-v5' }]);
    nameExists.mockResolvedValue(false);
    disclaimerAccepted.mockResolvedValue(true);
  });

  it('rejects creation when the workspace disclaimer is not accepted', async () => {
    disclaimerAccepted.mockResolvedValue(false);
    await expect(new FormService().create(baseCreate)).rejects.toMatchObject({ statusCode: 409 });
    expect(createForm).not.toHaveBeenCalled();
  });

  it('creates the form, an empty v1 draft and its settings rows in one transaction', async () => {
    createForm.mockResolvedValue({ id: 'f1', name: 'My Form' });
    createDraft.mockResolvedValue({ id: 'v1', formId: 'f1', versionNo: 1, state: 'draft' });

    const svc = new FormService();
    const res = await svc.create({
      workspaceId: 'ws1',
      actorId: 'a1',
      actorDisplayLabel: 'A',
      name: 'My Form',
    });

    expect(createForm).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Form', formEngineCode: 'formio-v5' }),
      expect.anything(),
    );
    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ formId: 'f1' }),
      expect.anything(),
    );
    const tx = createForm.mock.calls[0][1];
    expect(createSettings).toHaveBeenCalledWith(
      { workspaceId: 'ws1', formId: 'f1', actorId: 'a1', actorDisplayLabel: 'A' },
      tx,
    );
    expect(res).toEqual({
      form: { id: 'f1', name: 'My Form' },
      version: { id: 'v1', formId: 'f1', versionNo: 1, state: 'draft' },
    });
  });

  it('passes the settings sent with the form to its settings rows', async () => {
    createForm.mockResolvedValue({ id: 'f1', name: 'My Form' });
    createDraft.mockResolvedValue({ id: 'v1', formId: 'f1', versionNo: 1, state: 'draft' });
    const settings = {
      audience: { inherit: false as const, values: { mode: 'members' as const, idps: [] } },
    };

    await new FormService().create({ ...baseCreate, settings });

    expect(createSettings).toHaveBeenCalledWith(
      expect.objectContaining({ formId: 'f1', settings }),
      createForm.mock.calls[0][1],
    );
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
