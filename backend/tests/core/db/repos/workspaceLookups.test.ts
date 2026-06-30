const selectMock = jest.fn();

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

import { getFormListContext, getWorkspaceIdForForm } from '../../../../src/core/db/repos/formRepo';
import {
  getFormVersionListContext,
  getWorkspaceIdForFormVersion,
} from '../../../../src/core/db/repos/formVersionRepo';
import {
  getSubmissionListContext,
  getWorkspaceIdForSubmission,
} from '../../../../src/core/db/repos/submissionRepo';

function selectChain(result: unknown) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(result),
      }),
    }),
  };
}

beforeEach(() => {
  selectMock.mockReset();
});

describe('read-only workspace lookups', () => {
  it('getFormListContext returns workspace id when the form exists', async () => {
    selectMock.mockReturnValue(selectChain([{ workspaceId: 'ws1' }]));
    await expect(getFormListContext('form1')).resolves.toEqual({ workspaceId: 'ws1' });
  });

  it('getFormListContext returns null when the form is missing/deleted', async () => {
    selectMock.mockReturnValue(selectChain([]));
    await expect(getFormListContext('missing')).resolves.toBeNull();
  });

  it('getWorkspaceIdForForm delegates to getFormListContext', async () => {
    selectMock.mockReturnValue(selectChain([{ workspaceId: 'ws1' }]));
    await expect(getWorkspaceIdForForm('form1')).resolves.toBe('ws1');
  });

  it('getFormVersionListContext returns workspace and form id when present', async () => {
    selectMock.mockReturnValue(selectChain([{ workspaceId: 'ws2', formId: 'form1' }]));
    await expect(getFormVersionListContext('fv1')).resolves.toEqual({
      workspaceId: 'ws2',
      formId: 'form1',
    });
  });

  it('getFormVersionListContext returns null when missing', async () => {
    selectMock.mockReturnValue(selectChain([]));
    await expect(getFormVersionListContext('missing')).resolves.toBeNull();
  });

  it('getWorkspaceIdForFormVersion delegates to getFormVersionListContext', async () => {
    selectMock.mockReturnValue(selectChain([{ workspaceId: 'ws2', formId: 'form1' }]));
    await expect(getWorkspaceIdForFormVersion('fv1')).resolves.toBe('ws2');
  });

  it('getSubmissionListContext returns full hierarchy when present', async () => {
    selectMock.mockReturnValue(
      selectChain([{ workspaceId: 'ws3', formId: 'form1', formVersionId: 'fv1' }]),
    );
    await expect(getSubmissionListContext('sub1')).resolves.toEqual({
      workspaceId: 'ws3',
      formId: 'form1',
      formVersionId: 'fv1',
    });
  });

  it('getSubmissionListContext returns null when missing', async () => {
    selectMock.mockReturnValue(selectChain([]));
    await expect(getSubmissionListContext('missing')).resolves.toBeNull();
  });

  it('getWorkspaceIdForSubmission delegates to getSubmissionListContext', async () => {
    selectMock.mockReturnValue(
      selectChain([{ workspaceId: 'ws3', formId: 'form1', formVersionId: 'fv1' }]),
    );
    await expect(getWorkspaceIdForSubmission('sub1')).resolves.toBe('ws3');
  });
});
