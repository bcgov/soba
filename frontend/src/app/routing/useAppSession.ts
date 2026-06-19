'use client';

import { useEffect, useMemo } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useAppDispatch, useAppSelector } from '@/lib/store';
import { loadCurrentUser } from '@/lib/slices/currentUserSlice';
import { loadWorkspaces } from '@/lib/slices/workspaceSlice';
import { needsWorkspaceOnboarding } from '@/src/features/onboarding/workspaceOnboarding';
import type { AppSessionSnapshot } from './appRoutePolicy';

export function useAppSession(): AppSessionSnapshot {
  const { authenticated, token, initializing } = useKeycloak();
  const dispatch = useAppDispatch();

  const { workspaces, status: workspaceStatus } = useAppSelector((state) => state.workspace);
  const { data: currentUser, status: currentUserStatus } = useAppSelector(
    (state) => state.currentUser,
  );

  useEffect(() => {
    if (authenticated && token && workspaceStatus === 'idle') {
      dispatch(loadWorkspaces(token));
    }
  }, [authenticated, token, workspaceStatus, dispatch]);

  useEffect(() => {
    if (authenticated && token && currentUserStatus === 'idle') {
      dispatch(loadCurrentUser(token));
    }
  }, [authenticated, token, currentUserStatus, dispatch]);

  return useMemo(() => {
    const sessionReady = !authenticated
      ? !initializing
      : !initializing &&
        workspaceStatus === 'succeeded' &&
        currentUserStatus === 'succeeded';

    const sessionFailed =
      authenticated && (workspaceStatus === 'failed' || currentUserStatus === 'failed');

    const needsOnboarding = needsWorkspaceOnboarding({
      authenticated,
      initializing,
      workspaceStatus,
      currentUserStatus,
      workspaces,
      currentUser,
    });

    return {
      authenticated,
      initializing,
      sessionReady,
      sessionFailed,
      needsOnboarding,
      canCreateWorkspace: currentUser?.capabilities?.canCreateWorkspace === true,
      hasWorkspaces: workspaces.length > 0,
    };
  }, [
    authenticated,
    initializing,
    workspaceStatus,
    currentUserStatus,
    workspaces,
    currentUser,
  ]);
}
