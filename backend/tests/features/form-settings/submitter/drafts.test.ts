jest.mock('../../../../src/core/db/repos/submitterFormRepo', () => ({
  findSubmitterFormFacts: jest.fn(),
}));

import { DraftSaveStatus } from '@soba/lib';
import {
  getDraftSaveStatus,
  offersDraftSave,
} from '../../../../src/features/form-settings/submitter/drafts';
import { findSubmitterFormFacts } from '../../../../src/core/db/repos/submitterFormRepo';
import { NotFoundError } from '../../../../src/core/errors';
import { log } from '../../../../src/core/logging';

const mockFacts = jest.mocked(findSubmitterFormFacts);
const ctx = { workspaceId: 'ws1', actorDisplayLabel: null };

const facts = (allowSubmitterDrafts: boolean, audienceMode: 'public' | 'protected') => ({
  publishedVersionId: 'v1',
  permissions: [],
  audienceMode,
  audienceIdps: [],
  allowSubmitterDrafts,
});

beforeEach(() => jest.resetAllMocks());

describe('getDraftSaveStatus', () => {
  it("reads the form's facts without a caller", async () => {
    mockFacts.mockResolvedValue(facts(true, 'protected'));
    expect(await getDraftSaveStatus(ctx, 'f1')).toBe(DraftSaveStatus.allowed);
    expect(mockFacts).toHaveBeenCalledWith({ userId: null, workspaceId: 'ws1', formId: 'f1' });
  });

  it.each([
    [false, 'protected', DraftSaveStatus.disabled],
    [true, 'public', DraftSaveStatus.public],
  ] as const)('drafts %s with a %s audience is %s', async (allow, audience, expected) => {
    mockFacts.mockResolvedValue(facts(allow, audience));
    expect(await getDraftSaveStatus(ctx, 'f1')).toBe(expected);
  });

  it('is not found for a form outside the workspace', async () => {
    mockFacts.mockResolvedValue(null);
    await expect(getDraftSaveStatus(ctx, 'f1')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('offersDraftSave', () => {
  it('offers a draft save only when drafts are allowed', async () => {
    mockFacts.mockResolvedValue(facts(true, 'protected'));
    expect(await offersDraftSave(ctx, 'f1')).toBe(true);
    mockFacts.mockResolvedValue(facts(true, 'public'));
    expect(await offersDraftSave(ctx, 'f1')).toBe(false);
  });

  it('offers none, and logs, when the lookup fails', async () => {
    mockFacts.mockRejectedValue(new Error('read failed'));
    const error = jest.spyOn(log, 'error').mockImplementation(() => undefined);
    expect(await offersDraftSave(ctx, 'f1')).toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ formId: 'f1' }),
      'Draft save status lookup failed',
    );
    error.mockRestore();
  });
});
