jest.mock('../../../../src/features/form-settings/submitter/service', () => ({
  formSubmitterSettingsService: { get: jest.fn() },
}));
jest.mock('../../../../src/core/db/repos/formSubmitAccessRepo', () => ({
  isPublicAudience: jest.fn(),
}));

import {
  DraftSaveStatus,
  getDraftSaveStatus,
} from '../../../../src/features/form-settings/submitter/drafts';
import { formSubmitterSettingsService } from '../../../../src/features/form-settings/submitter/service';
import { isPublicAudience } from '../../../../src/core/db/repos/formSubmitAccessRepo';

const mockSettings = jest.mocked(formSubmitterSettingsService.get);
const mockPublic = jest.mocked(isPublicAudience);
const ctx = { workspaceId: 'ws1', actorDisplayLabel: null };

// The drafts flag the form inherits from its workspace; only the effective value matters here.
const inherited = (allowSubmitterDrafts: boolean) => ({
  inherit: true,
  own: null,
  workspace: { allowSubmitterDrafts },
  effective: { allowSubmitterDrafts },
  version: 1,
});

describe('getDraftSaveStatus', () => {
  beforeEach(() => jest.resetAllMocks());

  it('is disabled when allowSubmitterDrafts is off, without reading the audience', async () => {
    mockSettings.mockResolvedValue(inherited(false));
    expect(await getDraftSaveStatus(ctx, 'f1')).toBe(DraftSaveStatus.disabled);
    expect(mockSettings).toHaveBeenCalledWith(ctx, 'f1');
    expect(mockPublic).not.toHaveBeenCalled();
  });

  it('is public when drafts are on and the audience is public', async () => {
    mockSettings.mockResolvedValue(inherited(true));
    mockPublic.mockResolvedValue(true);
    expect(await getDraftSaveStatus(ctx, 'f1')).toBe(DraftSaveStatus.public);
    expect(mockPublic).toHaveBeenCalledWith({ workspaceId: 'ws1', formId: 'f1' });
  });

  it('is allowed when drafts are on and the audience is not public', async () => {
    mockSettings.mockResolvedValue(inherited(true));
    mockPublic.mockResolvedValue(false);
    expect(await getDraftSaveStatus(ctx, 'f1')).toBe(DraftSaveStatus.allowed);
  });
});
