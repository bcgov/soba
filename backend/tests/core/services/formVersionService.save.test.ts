import { FormVersionService } from '../../../src/core/services/formVersionService';
import * as repo from '../../../src/core/db/repos/formVersionRepo';

jest.mock('../../../src/core/db/client', () => ({
  db: { transaction: (cb: (tx: unknown) => unknown) => cb({}) },
}));

jest.mock('../../../src/core/db/repos/formVersionRepo', () => ({
  appendFormVersionRevision: jest.fn(),
  updateFormVersionDraft: jest.fn(),
}));

const appendRevision = repo.appendFormVersionRevision as unknown as jest.Mock;
const updateDraft = repo.updateFormVersionDraft as unknown as jest.Mock;

const baseInput = {
  workspaceId: 'ws1',
  actorId: 'a1',
  actorDisplayLabel: 'Author',
  formVersionId: 'v1',
  eventType: 'save_draft',
};

describe('FormVersionService.save', () => {
  beforeEach(() => jest.clearAllMocks());

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
});
