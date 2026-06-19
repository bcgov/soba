import { ForbiddenError } from '../../../../src/core/errors';

jest.mock('../../../../src/core/db/repos/membershipRepo', () => ({
  getWorkspaceForUser: jest.fn(),
  listWorkspacesForUser: jest.fn(),
  userHasWorkspaceManageMembership: jest.fn(),
}));

jest.mock('../../../../src/core/db/repos/workspaceRepo', () => ({
  createTeamWorkspace: jest.fn(),
  updateWorkspaceName: jest.fn(),
}));

import { workspacesApiService } from '../../../../src/core/api/workspaces/service';
import * as membershipRepo from '../../../../src/core/db/repos/membershipRepo';
import * as workspaceRepo from '../../../../src/core/db/repos/workspaceRepo';

const actorId = 'user-1';
const workspaceId = '11111111-1111-7111-8111-111111111111';

const workspaceRow = {
  id: workspaceId,
  name: 'Team Alpha',
  slug: null,
  kind: 'team',
  role: 'owner',
  status: 'active',
  membershipId: 'membership-1',
};

describe('WorkspacesApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create provisions a team workspace and returns the workspace item', async () => {
    jest.mocked(membershipRepo.userHasWorkspaceManageMembership).mockResolvedValue(true);
    jest.mocked(workspaceRepo.createTeamWorkspace).mockResolvedValue(workspaceId);
    jest.mocked(membershipRepo.getWorkspaceForUser).mockResolvedValue(workspaceRow);

    const result = await workspacesApiService.create(actorId, { name: 'Team Alpha' });

    expect(workspaceRepo.createTeamWorkspace).toHaveBeenCalledWith(actorId, 'Team Alpha');
    expect(result).toEqual({
      id: workspaceId,
      name: 'Team Alpha',
      slug: null,
      kind: 'team',
      role: 'owner',
      status: 'active',
    });
  });

  it('create throws ForbiddenError when actor has no owner or admin membership', async () => {
    jest.mocked(membershipRepo.userHasWorkspaceManageMembership).mockResolvedValue(false);

    await expect(
      workspacesApiService.create(actorId, { name: 'Team Alpha' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(workspaceRepo.createTeamWorkspace).not.toHaveBeenCalled();
  });

  it('updateName returns updated workspace when rename succeeds', async () => {
    jest.mocked(workspaceRepo.updateWorkspaceName).mockResolvedValue(true);
    jest.mocked(membershipRepo.getWorkspaceForUser).mockResolvedValue({
      ...workspaceRow,
      name: 'Renamed',
    });

    const result = await workspacesApiService.updateName(workspaceId, actorId, {
      name: 'Renamed',
    });

    expect(workspaceRepo.updateWorkspaceName).toHaveBeenCalledWith(workspaceId, actorId, 'Renamed');
    expect(result?.name).toBe('Renamed');
  });

  it('updateName throws ForbiddenError when actor cannot rename', async () => {
    jest.mocked(workspaceRepo.updateWorkspaceName).mockResolvedValue(false);

    await expect(
      workspacesApiService.updateName(workspaceId, actorId, { name: 'Renamed' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('updateName returns null when workspace is missing after update', async () => {
    jest.mocked(workspaceRepo.updateWorkspaceName).mockResolvedValue(true);
    jest.mocked(membershipRepo.getWorkspaceForUser).mockResolvedValue(null);

    const result = await workspacesApiService.updateName(workspaceId, actorId, {
      name: 'Renamed',
    });

    expect(result).toBeNull();
  });
});
