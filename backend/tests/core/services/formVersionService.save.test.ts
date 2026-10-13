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
}));

const appendRevision = repo.appendFormVersionRevision as unknown as jest.Mock;
const updateDraft = repo.updateFormVersionDraft as unknown as jest.Mock;
const lock = repo.lockFormVersion as unknown as jest.Mock;
const getCurrent = repo.getCurrentFormVersion as unknown as jest.Mock;

const baseInput = {
  workspaceId: 'ws1',
  actorId: 'a1',
  actorDisplayLabel: 'Author',
  formVersionId: 'v1',
  eventType: 'save_draft',
};

describe('FormVersionService.save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lock.mockResolvedValue({ id: 'v1', formId: 'f1', state: 'draft' });
    getCurrent.mockResolvedValue({ id: 'v1' });
  });

  // It can point a version at a different engine document, so it follows the schema save rules.
  it('refuses a version that is not a draft', async () => {
    lock.mockResolvedValue({ id: 'v1', formId: 'f1', state: 'published' });

    const svc = new FormVersionService();
    await expect(svc.save({ ...baseInput, engineSchemaRef: 'engine-123' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(appendRevision).not.toHaveBeenCalled();
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('refuses a version that is no longer the current one', async () => {
    getCurrent.mockResolvedValue({ id: 'v2' });

    const svc = new FormVersionService();
    await expect(svc.save({ ...baseInput, engineSchemaRef: 'engine-123' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it("sets engineSyncStatus='ready' when an engineSchemaRef is persisted", async () => {
    appendRevision.mockResolvedValue({ id: 'v1', formId: 'f1' });
    updateDraft.mockResolvedValue({ id: 'v1' });

    const svc = new FormVersionService();
    await svc.save({ ...baseInput, engineSchemaRef: 'engine-123' });

    expect(updateDraft).toHaveBeenCalledWith(
      'ws1',
      'v1',
      'Author',
      expect.objectContaining({ engineSchemaRef: 'engine-123', engineSyncStatus: 'ready' }),
      expect.anything(),
    );
  });

  it('does not change status when no engineSchemaRef is provided', async () => {
    appendRevision.mockResolvedValue({ id: 'v1', formId: 'f1' });

    const svc = new FormVersionService();
    await svc.save({ ...baseInput });

    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the version revision cannot be created', async () => {
    appendRevision.mockResolvedValue(null);

    const svc = new FormVersionService();
    await expect(svc.save({ ...baseInput, engineSchemaRef: 'engine-123' })).rejects.toThrow(
      /not found/i,
    );
    expect(updateDraft).not.toHaveBeenCalled();
  });
});
