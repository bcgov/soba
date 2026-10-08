const selectMock = jest.fn();

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

import { listFormsForWorkspace } from '../../../../src/core/db/repos/formRepo';
import {
  listFormVersionsForWorkspace,
  lookupFormVersions,
} from '../../../../src/core/db/repos/formVersionRepo';
import { listSubmissionsForWorkspace } from '../../../../src/core/db/repos/submissionRepo';
import type { FormAccessFilter } from '../../../../src/core/db/repos/formAccessRepo';

const FORM_ACCESS: FormAccessFilter = { actorId: 'actor1', required: ['form_read'] };

const listCalls = {
  listFormsForWorkspace: (workspaceIds: string[], formAccess: FormAccessFilter) =>
    listFormsForWorkspace({
      workspaceIds,
      formAccess,
      offset: 0,
      limit: 20,
      sort: 'createdAt:desc',
      locale: 'en',
    }),
  listFormVersionsForWorkspace: (workspaceIds: string[], formAccess: FormAccessFilter) =>
    listFormVersionsForWorkspace({
      workspaceIds,
      formAccess,
      offset: 0,
      limit: 20,
      sort: 'versionNo:desc',
    }),
  listSubmissionsForWorkspace: (workspaceIds: string[], formAccess: FormAccessFilter) =>
    listSubmissionsForWorkspace({
      workspaceIds,
      formAccess,
      offset: 0,
      limit: 20,
      sort: 'updatedAt:desc',
      locale: 'en',
    }),
};

// Without the guards the workspace or form filter is dropped and every row leaks.
describe('list repos refuse a missing scope', () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it.each(Object.entries(listCalls))(
    '%s returns nothing for no workspace, without querying',
    async (_name, list) => {
      await expect(list([], FORM_ACCESS)).resolves.toEqual({ items: [], total: 0 });
      expect(selectMock).not.toHaveBeenCalled();
    },
  );

  it.each(Object.entries(listCalls))(
    '%s returns nothing without an access filter, without querying',
    async (_name, list) => {
      await expect(list(['ws1'], undefined as unknown as FormAccessFilter)).resolves.toEqual({
        items: [],
        total: 0,
      });
      expect(selectMock).not.toHaveBeenCalled();
    },
  );

  it('lookupFormVersions returns nothing for no workspace, without querying', async () => {
    await expect(
      lookupFormVersions({ workspaceIds: [], formId: 'form1', limit: 501 }),
    ).resolves.toEqual([]);
    expect(selectMock).not.toHaveBeenCalled();
  });
});
