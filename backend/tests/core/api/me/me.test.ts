import { ForbiddenError } from '../../../../src/core/errors';

jest.mock('../../../../src/core/db/repos/appUserRepo', () => ({
  findAppUserById: jest.fn(),
  updateAppUserProfile: jest.fn(),
}));

jest.mock('../../../../src/core/db/repos/idpGroupRepo', () => ({
  canCreateWorkspaceByIdp: jest.fn(),
}));

jest.mock('../../../../src/core/db/repos/membershipRepo', () => ({
  actorBelongsToWorkspace: jest.fn(),
}));

import { meApiService } from '../../../../src/core/api/me/service';
import * as appUserRepo from '../../../../src/core/db/repos/appUserRepo';
import * as idpGroupRepo from '../../../../src/core/db/repos/idpGroupRepo';
import * as membershipRepo from '../../../../src/core/db/repos/membershipRepo';

const actorId = 'user-1';
const workspaceId = '11111111-1111-7111-8111-111111111111';

const baseUser = {
  id: actorId,
  displayLabel: 'Test User',
  profile: {
    displayName: 'Test User',
    email: 'test@example.com',
    preferredUsername: 'testuser',
  },
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'Test User',
  updatedBy: 'Test User',
};

describe('MeApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('get returns sanitized defaultWorkspaceId when membership is valid', async () => {
    jest.mocked(appUserRepo.findAppUserById).mockResolvedValue({
      ...baseUser,
      profile: {
        ...baseUser.profile,
        preferences: { defaultWorkspaceId: workspaceId },
      },
    });
    jest.mocked(membershipRepo.actorBelongsToWorkspace).mockResolvedValue(true);
    jest.mocked(idpGroupRepo.canCreateWorkspaceByIdp).mockResolvedValue(true);

    const result = await meApiService.get(actorId, 'idir');

    expect(result?.preferences.defaultWorkspaceId).toBe(workspaceId);
    expect(result?.capabilities.canCreateWorkspace).toBe(true);
    expect(idpGroupRepo.canCreateWorkspaceByIdp).toHaveBeenCalledWith('idir');
  });

  it('get returns null defaultWorkspaceId when stored workspace is invalid', async () => {
    jest.mocked(appUserRepo.findAppUserById).mockResolvedValue({
      ...baseUser,
      profile: {
        ...baseUser.profile,
        preferences: { defaultWorkspaceId: workspaceId },
      },
    });
    jest.mocked(membershipRepo.actorBelongsToWorkspace).mockResolvedValue(false);
    jest.mocked(idpGroupRepo.canCreateWorkspaceByIdp).mockResolvedValue(false);

    const result = await meApiService.get(actorId, 'bceidbusiness');

    expect(result?.preferences.defaultWorkspaceId).toBeNull();
    expect(result?.capabilities.canCreateWorkspace).toBe(false);
  });

  it('patch sets defaultWorkspaceId when user belongs to workspace', async () => {
    jest.mocked(appUserRepo.findAppUserById).mockResolvedValue(baseUser);
    jest.mocked(membershipRepo.actorBelongsToWorkspace).mockResolvedValue(true);
    jest.mocked(idpGroupRepo.canCreateWorkspaceByIdp).mockResolvedValue(true);
    jest.mocked(appUserRepo.updateAppUserProfile).mockResolvedValue({
      ...baseUser,
      profile: {
        ...baseUser.profile,
        preferences: { defaultWorkspaceId: workspaceId },
      },
    });

    const result = await meApiService.patch(actorId, 'idir', {
      preferences: { defaultWorkspaceId: workspaceId },
    });

    expect(appUserRepo.updateAppUserProfile).toHaveBeenCalledWith(
      actorId,
      expect.objectContaining({
        preferences: { defaultWorkspaceId: workspaceId },
      }),
      'Test User',
    );
    expect(result?.preferences.defaultWorkspaceId).toBe(workspaceId);
  });

  it('patch clears defaultWorkspaceId when null is sent', async () => {
    jest.mocked(appUserRepo.findAppUserById).mockResolvedValue({
      ...baseUser,
      profile: {
        ...baseUser.profile,
        preferences: { defaultWorkspaceId: workspaceId },
      },
    });
    jest.mocked(membershipRepo.actorBelongsToWorkspace).mockResolvedValue(true);
    jest.mocked(idpGroupRepo.canCreateWorkspaceByIdp).mockResolvedValue(true);
    jest.mocked(appUserRepo.updateAppUserProfile).mockResolvedValue({
      ...baseUser,
      profile: {
        ...baseUser.profile,
        preferences: { defaultWorkspaceId: null },
      },
    });

    const result = await meApiService.patch(actorId, 'idir', {
      preferences: { defaultWorkspaceId: null },
    });

    expect(appUserRepo.updateAppUserProfile).toHaveBeenCalledWith(
      actorId,
      expect.objectContaining({
        preferences: { defaultWorkspaceId: null },
      }),
      'Test User',
    );
    expect(result?.preferences.defaultWorkspaceId).toBeNull();
  });

  it('patch rejects defaultWorkspaceId when user is not a member', async () => {
    jest.mocked(appUserRepo.findAppUserById).mockResolvedValue(baseUser);
    jest.mocked(membershipRepo.actorBelongsToWorkspace).mockResolvedValue(false);

    await expect(
      meApiService.patch(actorId, 'idir', {
        preferences: { defaultWorkspaceId: workspaceId },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
