jest.mock('../../../../src/features/form-settings/submitter/service', () => ({
  submitterSettingsService: { get: jest.fn() },
}));
jest.mock('../../../../src/core/db/repos/formSubmitAccessRepo', () => ({
  isPublicSubmitterAudience: jest.fn(),
}));

import {
  DraftSaveStatus,
  getDraftSaveStatus,
} from '../../../../src/features/form-settings/submitter/drafts';
import { submitterSettingsService } from '../../../../src/features/form-settings/submitter/service';
import { isPublicSubmitterAudience } from '../../../../src/core/db/repos/formSubmitAccessRepo';

const mockSettings = jest.mocked(submitterSettingsService.get);
const mockPublic = jest.mocked(isPublicSubmitterAudience);
const ctx = { workspaceId: 'ws1', actorDisplayLabel: null };

describe('getDraftSaveStatus', () => {
  beforeEach(() => jest.resetAllMocks());

  it('is disabled when allowSubmitterDrafts is off, without reading the audience', async () => {
    mockSettings.mockResolvedValue({ allowSubmitterDrafts: false });
    expect(await getDraftSaveStatus(ctx, 'f1')).toBe(DraftSaveStatus.disabled);
    expect(mockSettings).toHaveBeenCalledWith(ctx, 'f1');
    expect(mockPublic).not.toHaveBeenCalled();
  });

  it('is public when drafts are on and the audience is public', async () => {
    mockSettings.mockResolvedValue({ allowSubmitterDrafts: true });
    mockPublic.mockResolvedValue(true);
    expect(await getDraftSaveStatus(ctx, 'f1')).toBe(DraftSaveStatus.public);
    expect(mockPublic).toHaveBeenCalledWith({ workspaceId: 'ws1', formId: 'f1' });
  });

  it('is allowed when drafts are on and the audience is not public', async () => {
    mockSettings.mockResolvedValue({ allowSubmitterDrafts: true });
    mockPublic.mockResolvedValue(false);
    expect(await getDraftSaveStatus(ctx, 'f1')).toBe(DraftSaveStatus.allowed);
  });
});
