import { FormVersionService } from '../../../src/core/services/formVersionService';
import * as repo from '../../../src/core/db/repos/formVersionRepo';

jest.mock('../../../src/core/db/client', () => ({
  db: { transaction: (cb: (tx: unknown) => unknown) => cb({}) },
}));

jest.mock('../../../src/core/db/repos/formVersionRepo', () => ({
  appendFormVersionRevision: jest.fn(),
  updateFormVersionDraft: jest.fn(),
  lockFormVersion: jest.fn(),
  getCurrentFormVersion: jest.fn(),
  nextFormVersionNo: jest.fn(),
}));

const appendRevision = repo.appendFormVersionRevision as unknown as jest.Mock;
const updateDraft = repo.updateFormVersionDraft as unknown as jest.Mock;
const lock = repo.lockFormVersion as unknown as jest.Mock;
const getCurrent = repo.getCurrentFormVersion as unknown as jest.Mock;
const nextNo = repo.nextFormVersionNo as unknown as jest.Mock;

const baseInput = {
  workspaceId: 'ws1',
  actorId: 'a1',
  actorDisplayLabel: 'Author',
  formVersionId: 'v1',
};

describe('FormVersionService.save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lock.mockResolvedValue({ id: 'v1', formId: 'f1', state: 'draft' });
    getCurrent.mockResolvedValue({ id: 'v1' });
  });

  // A save moves updatedAt, which provisioning matches on, so it follows the schema save rules.
  it('refuses a version that is not a draft', async () => {
    lock.mockResolvedValue({ id: 'v1', formId: 'f1', state: 'published' });

    const svc = new FormVersionService();
    await expect(svc.save(baseInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('refuses a version that is no longer the current one', async () => {
    getCurrent.mockResolvedValue({ id: 'v2' });

    const svc = new FormVersionService();
    await expect(svc.save(baseInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('appends a revision and leaves the engine document and sync status alone', async () => {
    appendRevision.mockResolvedValue({ id: 'v1', formId: 'f1' });

    const svc = new FormVersionService();
    await svc.save({ ...baseInput, note: 'Reworded the intro' });

    expect(appendRevision).toHaveBeenCalledWith(
      {
        workspaceId: 'ws1',
        formVersionId: 'v1',
        actorId: 'a1',
        actorDisplayLabel: 'Author',
        eventType: 'save_draft',
        changeNote: 'Reworded the intro',
      },
      expect.anything(),
    );
    expect(updateDraft).not.toHaveBeenCalled();
  });

  // It is not the current version until this save, so the current-version check does not apply.
  it('makes an opened version a draft under the next free number, with the revision', async () => {
    lock.mockResolvedValue({ id: 'v1', workspaceId: 'ws1', formId: 'f1', state: 'opened' });
    getCurrent.mockResolvedValue({ id: 'v0' });
    nextNo.mockResolvedValue(2);
    appendRevision.mockResolvedValue({ id: 'v1', formId: 'f1', state: 'draft' });

    const svc = new FormVersionService();
    await svc.save(baseInput);

    expect(updateDraft).toHaveBeenCalledWith(
      'ws1',
      'v1',
      'Author',
      { state: 'draft', versionNo: 2 },
      expect.anything(),
    );
    expect(appendRevision).toHaveBeenCalled();
  });

  it('throws NotFoundError when the version revision cannot be created', async () => {
    appendRevision.mockResolvedValue(null);

    const svc = new FormVersionService();
    await expect(svc.save(baseInput)).rejects.toThrow(/not found/i);
  });
});
