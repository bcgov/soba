import { describe, it, expect } from 'vitest';
import { isWorkspaceManageRole } from '@/src/features/workspaces/workspaceRoles';

describe('workspaceRoles', () => {
  it('isWorkspaceManageRole allows owner and admin only', () => {
    expect(isWorkspaceManageRole('owner')).toBe(true);
    expect(isWorkspaceManageRole('admin')).toBe(true);
    expect(isWorkspaceManageRole('member')).toBe(false);
    expect(isWorkspaceManageRole('viewer')).toBe(false);
  });
});
