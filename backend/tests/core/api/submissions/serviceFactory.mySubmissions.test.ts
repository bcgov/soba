import { createSubmissionsApiService } from '../../../../src/core/api/submissions/serviceFactory';
import type { SubmissionService } from '../../../../src/core/services/submissionService';

const row = (id: string, workflowState: string, role = 'owner') => ({
  id,
  formId: 'f1',
  formName: 'Form One',
  workflowState,
  role,
  submittedAt: workflowState === 'submitted' ? new Date('2026-01-02T00:00:00Z') : null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-03T00:00:00Z'),
  confirmationCode: 'K7M2Q9XA',
});

const query = {
  offset: 10,
  limit: 5,
  workflowState: 'draft' as const,
  q: 'tax',
  sort: 'updatedAt:desc' as const,
  locale: 'fr' as const,
};

describe("listMine: the caller's own submissions", () => {
  it('reads as the caller with the declared query fields only', async () => {
    const listForParticipant = jest.fn().mockResolvedValue({ items: [], total: 0 });
    const api = createSubmissionsApiService({ listForParticipant } as unknown as SubmissionService);

    await api.listMine('u1', { ...query, userId: 'someone-else' } as typeof query);

    expect(listForParticipant).toHaveBeenCalledWith({ userId: 'u1', ...query });
  });

  it('returns slim rows, with the code only once submitted, and echoes the query', async () => {
    const api = createSubmissionsApiService({
      listForParticipant: jest.fn().mockResolvedValue({
        items: [row('s1', 'draft'), row('s2', 'submitted', 'collaborator')],
        total: 12,
      }),
    } as unknown as SubmissionService);

    const result = await api.listMine('u1', query);

    expect(result.items).toEqual([
      {
        id: 's1',
        formId: 'f1',
        formName: 'Form One',
        workflowState: 'draft',
        role: 'owner',
        submittedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
        confirmationCode: null,
      },
      expect.objectContaining({
        id: 's2',
        role: 'collaborator',
        submittedAt: '2026-01-02T00:00:00.000Z',
        confirmationCode: 'K7M2Q9XA',
      }),
    ]);
    expect(result.page).toEqual({ offset: 10, limit: 5, total: 12 });
    expect(result.filters).toEqual({ workflowState: 'draft', q: 'tax' });
    expect(result.sort).toBe('updatedAt:desc');
  });
});
