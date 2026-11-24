import { navLink } from '@/src/shared/list/listQueryMemory';
import { ROUTE_KIND_BY_SEGMENT } from './routeSegments';

export type RouteKind = 'home' | 'onboarding' | 'workspace-app' | 'workspaces' | 'public';

export type AppSessionSnapshot = {
  authenticated: boolean;
  initializing: boolean;
  /** Keycloak init has been dispatched, so `authenticated` is an answer rather than a default. */
  initStarted: boolean;
  sessionReady: boolean;
  /** Every bootstrap read has produced data at least once. */
  sessionLoadedOnce: boolean;
  /** A required bootstrap fetch (current user or workspaces) rejected. */
  sessionFailed: boolean;
  /** Keycloak failed to start, so there is no sign-in to send anyone to. */
  authUnavailable: boolean;
  needsOnboarding: boolean;
  canCreateWorkspace: boolean;
  hasWorkspaces: boolean;
};

/** Where the guard sends the visitor: another app path, or sign-in and back to this page. */
export type RouteRedirect = { kind: 'path'; to: string } | { kind: 'sign-in' };

const toPath = (to: string): RouteRedirect => ({ kind: 'path', to });
const SIGN_IN: RouteRedirect = { kind: 'sign-in' };

/** Classify the localized route (pathname includes `/{locale}/...`). */
export function classifyRoute(pathname: string): RouteKind {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return 'home';
  }

  const route = segments[1] ?? '';
  return ROUTE_KIND_BY_SEGMENT[route] ?? 'public';
}

function resolveLanding(
  locale: string,
  onboarding: string,
  session: AppSessionSnapshot,
  designMode: boolean,
): string {
  if (!designMode) {
    return `/${locale}/my-forms`;
  }
  if (session.needsOnboarding) {
    return onboarding;
  }
  if (session.canCreateWorkspace && !session.hasWorkspaces) {
    return `/${locale}/workspaces`;
  }
  // Marked as an in-app arrival so the list comes back as the user left it.
  return navLink(`/${locale}/forms`);
}

/**
 * Returns where to send the visitor, or null when the current route may render. A signed-out
 * visitor on a guarded route signs in and comes back to it, unless Keycloak failed to start.
 * Caller should wait until `sessionReady` before redirecting authenticated users.
 *
 * `designMode` is this deployment's DESIGN_MODE gate. When off, users land on My Forms and
 * workspace onboarding is skipped; `canCreateWorkspace` is per-user and not mode-aware.
 */
export function resolveRedirect(
  pathname: string,
  locale: string,
  session: AppSessionSnapshot,
  designMode: boolean,
): RouteRedirect | null {
  // Before Keycloak has answered, `authenticated: false` is only a default, so acting on it would
  // send a signed-in visitor to sign in.
  if (session.initializing || !session.initStarted) {
    return null;
  }

  const kind = classifyRoute(pathname);
  const home = `/${locale}`;
  const onboarding = `/${locale}/onboarding`;

  if (!session.authenticated) {
    if (kind === 'home' || kind === 'public') {
      return null;
    }
    return session.authUnavailable ? toPath(home) : SIGN_IN;
  }

  if (!session.sessionReady) {
    return null;
  }

  const needsOnboarding = designMode && session.needsOnboarding;
  const landing = resolveLanding(locale, onboarding, session, designMode);

  if (kind === 'home') {
    return toPath(landing);
  }

  if (kind === 'onboarding') {
    return needsOnboarding ? null : toPath(landing);
  }

  if (needsOnboarding && kind !== 'public') {
    return toPath(onboarding);
  }

  return null;
}
