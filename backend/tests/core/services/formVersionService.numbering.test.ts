import { FormVersionService } from '../../../src/core/services/formVersionService';
import * as repo from '../../../src/core/db/repos/formVersionRepo';
import * as formRepo from '../../../src/core/db/repos/formRepo';
import * as engineSchema from '../../../src/core/services/engineSchema';

jest.mock('../../../src/core/db/client', () => ({
  db: { transaction: (cb: (tx: unknown) => unknown) => cb({}) },
}));

jest.mock('../../../src/core/db/repos/formVersionRepo', () => ({
  findFormVersionAnywhere: jest.fn(),
  getFormVersionById: jest.fn(),
  getFormVersionByIdIncludingDeleted: jest.fn(),
  createFormVersionDraft: jest.fn(),
  lockFormVersion: jest.fn(),
  getCurrentFormVersion: jest.fn(),
  getPublishedVersionForForm: jest.fn(),
  updateFormVersionDraft: jest.fn(),
  appendFormVersionRevision: jest.fn(),
  nextFormVersionNo: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/formRepo', () => ({
  getFormById: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/documentTemplateRepo', () => ({
  copyDocumentTemplates: jest.fn(),
}));

jest.mock('../../../src/core/services/engineSchema', () => ({
  writeEngineSchema: jest.fn(),
  readEngineSchema: jest.fn(),
}));

const findAnywhere = repo.findFormVersionAnywhere as unknown as jest.Mock;
const getById = repo.getFormVersionById as unknown as jest.Mock;
const getByIdInclDeleted = repo.getFormVersionByIdIncludingDeleted as unknown as jest.Mock;
const createDraft = repo.createFormVersionDraft as unknown as jest.Mock;
const lock = repo.lockFormVersion as unknown as jest.Mock;
const getCurrent = repo.getCurrentFormVersion as unknown as jest.Mock;
const getPublished = repo.getPublishedVersionForForm as unknown as jest.Mock;
const updateDraft = repo.updateFormVersionDraft as unknown as jest.Mock;
const appendRevision = repo.appendFormVersionRevision as unknown as jest.Mock;
const nextNo = repo.nextFormVersionNo as unknown as jest.Mock;
const getFormById = formRepo.getFormById as unknown as jest.Mock;
const writeSchema = engineSchema.writeEngineSchema as unknown as jest.Mock;
const readSchema = engineSchema.readEngineSchema as unknown as jest.Mock;

const actor = { workspaceId: 'ws1', actorId: 'a1', actorDisplayLabel: 'Author' };

/** A version as the repo returns it; opened versions show the number they would take. */
const version = (id: string, state: string, versionNo = 2) => ({
  id,
  workspaceId: 'ws1',
  formId: 'f1',
  versionNo,
  state,
  engineSchemaRef: `eng-${id}`,
  engineSyncStatus: 'ready',
});

/** A unique violation as Drizzle surfaces it: the pg error sits on the wrapper's cause. */
const uniqueViolationOn = (constraint: string) =>
  Object.assign(new Error('Failed query'), {
    cause: { code: '23505', severity: 'ERROR', constraint },
  });

/** The patch the service wrote to a version, by id. */
const patchFor = (id: string) =>
  updateDraft.mock.calls.find((call) => call[1] === id)?.[3] as Record<string, unknown>;

const svc = new FormVersionService();

describe('FormVersionService numbering of opened versions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFormById.mockResolvedValue({ id: 'f1', name: 'Form', formEngineCode: 'formio' });
    getById.mockResolvedValue(version('v1', 'published', 1));
    findAnywhere.mockResolvedValue(null);
    readSchema.mockResolvedValue({ components: [] });
    writeSchema.mockImplementation((input: { formVersionId: string }) =>
      Promise.resolve(`eng-${input.formVersionId}`),
    );
    createDraft.mockImplementation((input: { id: string }) =>
      Promise.resolve(version(input.id, 'opened')),
    );
    updateDraft.mockImplementation((_ws: string, id: string, _by: string, patch: object) =>
      Promise.resolve({ ...version(id, 'draft'), ...patch }),
    );
    appendRevision.mockImplementation((input: { formVersionId: string }) =>
      Promise.resolve(version(input.formVersionId, 'draft')),
    );
    getPublished.mockResolvedValue(version('v1', 'published', 1));
    getCurrent.mockResolvedValue(version('v1', 'published', 1));
  });

  // Both show 2. The first saved takes it; by the second save the repo counts it, and gives 3.
  it('numbers two opened versions in the order they are saved', async () => {
    await svc.createDraft({ ...actor, id: 'a', formId: 'f1', fromFormVersionId: 'v1' });
    await svc.createDraft({ ...actor, id: 'b', formId: 'f1', fromFormVersionId: 'v1' });
    lock
      .mockResolvedValueOnce(version('b', 'opened'))
      .mockResolvedValueOnce(version('a', 'opened'));
    nextNo.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    await svc.save({ ...actor, formVersionId: 'b' });
    await svc.save({ ...actor, formVersionId: 'a' });

    expect(patchFor('b')).toEqual({ state: 'draft', versionNo: 2 });
    expect(patchFor('a')).toEqual({ state: 'draft', versionNo: 3 });
    // Each number is read inside the save's own transaction, after the one before committed.
    expect(nextNo).toHaveBeenNthCalledWith(1, 'ws1', 'f1', expect.anything());
    expect(nextNo).toHaveBeenNthCalledWith(2, 'ws1', 'f1', expect.anything());
    // Neither was the current version; an opened version is saved without that check.
    expect(getCurrent).not.toHaveBeenCalled();
  });

  // Two saves that both read 2 would leave the database to refuse the second.
  it('saves nothing when the database refuses the number', async () => {
    lock.mockResolvedValue(version('a', 'opened'));
    nextNo.mockResolvedValue(2);
    updateDraft.mockRejectedValue(uniqueViolationOn('form_version_workspace_form_version_uq'));

    await expect(svc.save({ ...actor, formVersionId: 'a' })).rejects.toMatchObject({
      cause: { constraint: 'form_version_workspace_form_version_uq' },
    });
    expect(appendRevision).not.toHaveBeenCalled();
  });

  // Only a draft is deleted, so an unsaved version is left behind rather than deleted; it holds no
  // number, so the next one is created and saved under the number it showed.
  it('refuses to delete an opened version, and the next is still saved under its number', async () => {
    getByIdInclDeleted.mockResolvedValue(version('a', 'opened'));

    await expect(svc.delete({ ...actor, formVersionId: 'a' })).rejects.toThrow(
      'Only draft versions can be deleted',
    );
    expect(updateDraft).not.toHaveBeenCalled();

    await svc.createDraft({ ...actor, id: 'b', formId: 'f1', fromFormVersionId: 'v1' });
    lock.mockResolvedValue(version('b', 'opened'));
    nextNo.mockResolvedValue(2);
    await svc.save({ ...actor, formVersionId: 'b' });

    expect(patchFor('b')).toEqual({ state: 'draft', versionNo: 2 });
  });

  // Its schema was written when it was created, so it publishes without a save first.
  it('publishes an opened version without a save, under the next number, archiving the live one', async () => {
    await svc.createDraft({ ...actor, id: 'a', formId: 'f1', fromFormVersionId: 'v1' });
    lock.mockResolvedValue(version('a', 'opened'));
    nextNo.mockResolvedValue(2);

    await svc.publish({ ...actor, formVersionId: 'a' });

    expect(patchFor('v1')).toMatchObject({ state: 'archived' });
    expect(patchFor('a')).toMatchObject({
      state: 'published',
      versionNo: 2,
      publishedBy: 'a1',
      publishedAt: expect.any(Date),
    });
    expect(appendRevision).not.toHaveBeenCalled();
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('publishes an opened version under the next free number once another took the one it showed', async () => {
    lock.mockResolvedValue(version('b', 'opened'));
    nextNo.mockResolvedValue(3);

    await svc.publish({ ...actor, formVersionId: 'b' });

    expect(patchFor('b')).toMatchObject({ state: 'published', versionNo: 3 });
  });

  // A version already numbered keeps its number when it is published.
  it('leaves the number of a draft alone when it is published', async () => {
    lock.mockResolvedValue(version('a', 'draft'));
    getCurrent.mockResolvedValue(version('a', 'draft'));

    await svc.publish({ ...actor, formVersionId: 'a' });

    expect(nextNo).not.toHaveBeenCalled();
    expect(patchFor('a')).not.toHaveProperty('versionNo');
  });
});
