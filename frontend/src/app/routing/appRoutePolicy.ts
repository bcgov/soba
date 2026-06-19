export type RouteKind = 'home' | 'onboarding' | 'workspace-app' | 'workspaces' | 'public';

export type AppSessionSnapshot = {
  authenticated: boolean;
  initializing: boolean;
  sessionReady: boolean;
  needsOnboarding: boolean;
  canCreateWorkspace: boolean;
  hasWorkspaces: boolean;
};

const WORKSPACE_APP_SEGMENTS = new Set(['forms', 'designer', 'form', 'submissions', 'submission']);
const WORKSPACE_SEGMENTS = new Set(['workspaces', 'workspace']);
const PUBLIC_SEGMENTS = new Set(['help', 'feedback']);

/** Classify the localized route (pathname includes `/{locale}/...`). */
export function classifyRoute(pathname: string): RouteKind {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return 'home';
  }

  const route = segments[1] ?? '';
  if (route === 'onboarding') return 'onboarding';
  if (WORKSPACE_APP_SEGMENTS.has(route)) return 'workspace-app';
  if (WORKSPACE_SEGMENTS.has(route)) return 'workspaces';
  if (PUBLIC_SEGMENTS.has(route)) return 'public';
  return 'public';
}

/**
 * Returns a path to `router.replace`, or null when the current route may render.
 * Caller should wait until `sessionReady` before redirecting authenticated users.
 */
export function resolveRedirect(
  pathname: string,
  locale: string,
  session: AppSessionSnapshot,
): string | null {
  if (session.initializing) {
    return null;
  }

  const kind = classifyRoute(pathname);
  const home = `/${locale}`;
  const onboarding = `/${locale}/onboarding`;
  const forms = `/${locale}/forms`;
  const workspaces = `/${locale}/workspaces`;

  if (!session.authenticated) {
    if (kind === 'home' || kind === 'public') {
      return null;
    }
    return home;
  }

  if (!session.sessionReady) {
    return null;
  }

  if (kind === 'home') {
    return session.needsOnboarding ? onboarding : forms;
  }

  if (kind === 'onboarding') {
    if (session.needsOnboarding) {
      return null;
    }
    if (session.canCreateWorkspace && !session.hasWorkspaces) {
      return workspaces;
    }
    return forms;
  }

  if (kind === 'workspace-app' && session.needsOnboarding) {
    return onboarding;
  }

  return null;
}
