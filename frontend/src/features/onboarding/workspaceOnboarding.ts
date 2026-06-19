import type { CurrentUserResponse } from '@/src/types/user';
import type { WorkspaceItem } from '@/src/types/workspaces';

type WorkspaceOnboardingInput = {
  authenticated: boolean;
  initializing: boolean;
  workspaceStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  currentUserStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  workspaces: WorkspaceItem[];
  currentUser: CurrentUserResponse | null;
};

/** Signed-in user with no workspace access and no path to create a workspace. */
export function needsWorkspaceOnboarding({
  authenticated,
  initializing,
  workspaceStatus,
  currentUserStatus,
  workspaces,
  currentUser,
}: WorkspaceOnboardingInput): boolean {
  if (!authenticated || initializing) return false;
  if (workspaceStatus !== 'succeeded' || currentUserStatus !== 'succeeded') return false;
  if (workspaces.length > 0) return false;
  return currentUser?.capabilities?.canCreateWorkspace !== true;
}

export function isWorkspaceOnboardingReady({
  authenticated,
  initializing,
  workspaceStatus,
  currentUserStatus,
}: Pick<
  WorkspaceOnboardingInput,
  'authenticated' | 'initializing' | 'workspaceStatus' | 'currentUserStatus'
>): boolean {
  if (!authenticated || initializing) return false;
  return workspaceStatus === 'succeeded' && currentUserStatus === 'succeeded';
}
