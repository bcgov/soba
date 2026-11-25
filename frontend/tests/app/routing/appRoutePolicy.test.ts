import { describe, it, expect } from 'vitest';
import {
  classifyRoute,
  resolveRedirect,
  type RouteRedirect,
} from '@/src/app/routing/appRoutePolicy';

const readySession = {
  authenticated: true,
  initializing: false,
  initStarted: true,
  sessionReady: true,
  sessionLoadedOnce: true,
  sessionFailed: false,
  authUnavailable: false,
  needsOnboarding: false,
  canCreateWorkspace: false,
  hasWorkspaces: true,
};

const go = (to: string): RouteRedirect => ({ kind: 'path', to });
const SIGN_IN: RouteRedirect = { kind: 'sign-in' };

describe('classifyRoute', () => {
  it('classifies home, onboarding, workspace-app, workspaces, and public routes', () => {
    expect(classifyRoute('/en')).toBe('home');
    expect(classifyRoute('/fr/onboarding')).toBe('onboarding');
    expect(classifyRoute('/en/forms')).toBe('workspace-app');
    expect(classifyRoute('/en/build/abc')).toBe('workspace-app');
    expect(classifyRoute('/en/my-forms')).toBe('workspace-app');
    expect(classifyRoute('/en/my-submissions')).toBe('workspace-app');
    expect(classifyRoute('/en/workspaces')).toBe('workspaces');
    expect(classifyRoute('/en/workspace/ws1')).toBe('workspaces');
    expect(classifyRoute('/en/help')).toBe('public');
    // The fill/submit route and single-submission view are public so anonymous submitters can reach
    // a public-audience form and see their confirmation; the backend authorizes the data.
    expect(classifyRoute('/en/form/abc')).toBe('public');
    expect(classifyRoute('/en/submit/sub1')).toBe('public');
    expect(classifyRoute('/en/submission/sub1')).toBe('public');
  });
});

// Design mode enabled for the deployment, alone or with submit mode.
describe('resolveRedirect - design mode enabled', () => {
  // Keycloak brings the visitor back to the guarded page, so an emailed deep link survives sign-in.
  it('sends unauthenticated users on guarded routes to sign in', () => {
    const guest = { ...readySession, authenticated: false };
    const guarded = [
      '/en/forms',
      '/en/build/abc',
      '/en/workspaces',
      '/en/workspace/ws1',
      '/en/admin',
      '/en/onboarding',
    ];
    for (const path of guarded) {
      expect(resolveRedirect(path, 'en', guest, true)).toEqual(SIGN_IN);
    }
  });

  it('sends unauthenticated users home when Keycloak failed to start', () => {
    const guest = { ...readySession, authenticated: false, authUnavailable: true };
    expect(resolveRedirect('/en/build/abc', 'en', guest, true)).toEqual(go('/en'));
    expect(resolveRedirect('/en/form/abc', 'en', guest, true)).toBeNull();
  });

  // Before Keycloak has run, `authenticated: false` is the default rather than an answer. Acting on
  // it bounces a deep link through home to the landing route, losing the path and its query string.
  it('does not redirect before Keycloak init has started', () => {
    const unstarted = { ...readySession, authenticated: false, initStarted: false };
    expect(resolveRedirect('/en/forms', 'en', unstarted, true)).toBeNull();
    expect(resolveRedirect('/en/workspaces', 'en', unstarted, true)).toBeNull();
    expect(resolveRedirect('/en/build/abc', 'en', unstarted, true)).toBeNull();
  });

  it('allows unauthenticated users on home and public routes', () => {
    const guest = { ...readySession, authenticated: false, sessionReady: true };
    expect(resolveRedirect('/en', 'en', guest, true)).toBeNull();
    expect(resolveRedirect('/en/help', 'en', guest, true)).toBeNull();
    expect(resolveRedirect('/en/form/abc', 'en', guest, true)).toBeNull();
    expect(resolveRedirect('/en/submission/sub1', 'en', guest, true)).toBeNull();
  });

  it('sends authenticated home visitors to onboarding or forms', () => {
    expect(resolveRedirect('/en', 'en', { ...readySession, needsOnboarding: true }, true)).toEqual(
      go('/en/onboarding'),
    );
    expect(resolveRedirect('/en', 'en', readySession, true)).toEqual(go('/en/forms?from=nav'));
  });

  it('sends a brand-new creator from home to workspaces, matching onboarding', () => {
    const newCreator = { ...readySession, hasWorkspaces: false, canCreateWorkspace: true };
    expect(resolveRedirect('/en', 'en', newCreator, true)).toEqual(go('/en/workspaces'));
    expect(resolveRedirect('/en/onboarding', 'en', newCreator, true)).toEqual(go('/en/workspaces'));
  });

  it('keeps onboarding users on onboarding and redirects others away', () => {
    const onboarding = { ...readySession, needsOnboarding: true };
    expect(resolveRedirect('/en/onboarding', 'en', onboarding, true)).toBeNull();
    expect(resolveRedirect('/en/forms', 'en', onboarding, true)).toEqual(go('/en/onboarding'));
  });

  it('funnels onboarding users off workspace routes but not public ones', () => {
    const onboarding = { ...readySession, needsOnboarding: true };
    expect(resolveRedirect('/en/workspaces', 'en', onboarding, true)).toEqual(go('/en/onboarding'));
    expect(resolveRedirect('/en/workspace/ws1', 'en', onboarding, true)).toEqual(
      go('/en/onboarding'),
    );
    expect(resolveRedirect('/en/help', 'en', onboarding, true)).toBeNull();
  });

  it('funnels onboarding users off submit routes too', () => {
    const onboarding = { ...readySession, needsOnboarding: true };
    expect(resolveRedirect('/en/my-forms', 'en', onboarding, true)).toEqual(go('/en/onboarding'));
    expect(resolveRedirect('/en/my-submissions', 'en', onboarding, true)).toEqual(
      go('/en/onboarding'),
    );
  });

  it('redirects off onboarding when access is available', () => {
    expect(resolveRedirect('/en/onboarding', 'en', readySession, true)).toEqual(
      go('/en/forms?from=nav'),
    );
    expect(
      resolveRedirect(
        '/en/onboarding',
        'en',
        { ...readySession, hasWorkspaces: false, canCreateWorkspace: true },
        true,
      ),
    ).toEqual(go('/en/workspaces'));
  });

  it('waits for session bootstrap before redirecting authenticated users', () => {
    expect(resolveRedirect('/en', 'en', { ...readySession, sessionReady: false }, true)).toBeNull();
  });
});

// Submit-only: design mode disabled, so no workspace onboarding/create landing.
describe('resolveRedirect - submit only', () => {
  it('lands authenticated users on my forms regardless of workspace state', () => {
    expect(resolveRedirect('/en', 'en', { ...readySession, needsOnboarding: true }, false)).toEqual(
      go('/en/my-forms'),
    );
    const newCreator = { ...readySession, hasWorkspaces: false, canCreateWorkspace: true };
    expect(resolveRedirect('/en', 'en', newCreator, false)).toEqual(go('/en/my-forms'));
    expect(resolveRedirect('/en', 'en', readySession, false)).toEqual(go('/en/my-forms'));
  });

  it('does not funnel users into the workspace onboarding dead-end', () => {
    const onboarding = { ...readySession, needsOnboarding: true };
    expect(resolveRedirect('/en/my-forms', 'en', onboarding, false)).toBeNull();
    expect(resolveRedirect('/en/onboarding', 'en', onboarding, false)).toEqual(go('/en/my-forms'));
  });

  it('defers workspace routes to the layout 404', () => {
    // needsOnboarding is suppressed, so the guard returns null and defers to the route's notFound().
    const onboarding = { ...readySession, needsOnboarding: true };
    expect(resolveRedirect('/en/workspaces', 'en', onboarding, false)).toBeNull();
    expect(resolveRedirect('/en/workspace/ws1', 'en', onboarding, false)).toBeNull();
  });

  it('sends unauthenticated users on guarded routes to sign in', () => {
    const guest = { ...readySession, authenticated: false };
    expect(resolveRedirect('/en/my-forms', 'en', guest, false)).toEqual(SIGN_IN);
    expect(resolveRedirect('/en/my-submissions', 'en', guest, false)).toEqual(SIGN_IN);
  });
});
