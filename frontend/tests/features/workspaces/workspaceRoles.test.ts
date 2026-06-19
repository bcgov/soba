import { describe, it, expect } from 'vitest';
import {
  isWorkspaceManageRole,
  userCanCreateWorkspace,
} from '@/src/features/workspaces/workspaceRoles';

describe('workspaceRoles', () => {
  it('isWorkspaceManageRole allows owner and admin only', () => {
    expect(isWorkspaceManageRole('owner')).toBe(true);
    expect(isWorkspaceManageRole('admin')).toBe(true);
    expect(isWorkspaceManageRole('member')).toBe(false);
    expect(isWorkspaceManageRole('viewer')).toBe(false);
  });

  it('userCanCreateWorkspace is true when any workspace is owner or admin', () => {
    expect(
      userCanCreateWorkspace([
        { role: 'member' },
        { role: 'admin' },
      ]),
    ).toBe(true);
    expect(userCanCreateWorkspace([{ role: 'member' }, { role: 'viewer' }])).toBe(false);
  });
});
