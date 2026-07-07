import { describe, it, expect } from 'vitest';
import { classifyRoute, resolveRedirect } from '@/src/app/routing/appRoutePolicy';

const readySession = {
  authenticated: true,
  initializing: false,
  sessionReady: true,
  sessionFailed: false,
  needsOnboarding: false,
  canCreateWorkspace: false,
  hasWorkspaces: true,
};

describe('classifyRoute', () => {
  it('classifies home, onboarding, workspace-app, workspaces, and public routes', () => {
    expect(classifyRoute('/en')).toBe('home');
    expect(classifyRoute('/fr/onboarding')).toBe('onboarding');
    expect(classifyRoute('/en/forms')).toBe('workspace-app');
    expect(classifyRoute('/en/designer/abc')).toBe('workspace-app');
    expect(classifyRoute('/en/workspaces')).toBe('workspaces');
    expect(classifyRoute('/en/workspace/ws1')).toBe('workspaces');
    expect(classifyRoute('/en/help')).toBe('public');
    // The fill/submit route and single-submission view are public so anonymous submitters can reach
    // a public-audience form and see their confirmation; the backend authorizes the data.
    expect(classifyRoute('/en/form/abc')).toBe('public');
    expect(classifyRoute('/en/submission/sub1')).toBe('public');
    // The submissions management table stays staff-only.
    expect(classifyRoute('/en/submissions/f1')).toBe('workspace-app');
  });
});

describe('resolveRedirect', () => {
  it('sends unauthenticated users on protected routes to home', () => {
    expect(
      resolveRedirect('/en/forms', 'en', {
        ...readySession,
        authenticated: false,
        sessionReady: true,
      }),
    ).toBe('/en');
  });

  it('allows unauthenticated users on home and public routes', () => {
    const guest = { ...readySession, authenticated: false, sessionReady: true };
    expect(resolveRedirect('/en', 'en', guest)).toBeNull();
    expect(resolveRedirect('/en/help', 'en', guest)).toBeNull();
    expect(resolveRedirect('/en/form/abc', 'en', guest)).toBeNull();
    expect(resolveRedirect('/en/submission/sub1', 'en', guest)).toBeNull();
  });

  it('sends authenticated home visitors to onboarding or forms', () => {
    expect(
      resolveRedirect('/en', 'en', { ...readySession, needsOnboarding: true }),
    ).toBe('/en/onboarding');
    expect(resolveRedirect('/en', 'en', readySession)).toBe('/en/forms');
  });

  it('sends a brand-new creator from home to workspaces, matching onboarding', () => {
    const newCreator = { ...readySession, hasWorkspaces: false, canCreateWorkspace: true };
    expect(resolveRedirect('/en', 'en', newCreator)).toBe('/en/workspaces');
    expect(resolveRedirect('/en/onboarding', 'en', newCreator)).toBe('/en/workspaces');
  });

  it('keeps onboarding users on onboarding and redirects others away', () => {
    const onboarding = { ...readySession, needsOnboarding: true };
    expect(resolveRedirect('/en/onboarding', 'en', onboarding)).toBeNull();
    expect(resolveRedirect('/en/forms', 'en', onboarding)).toBe('/en/onboarding');
  });

  it('funnels onboarding users off workspace routes but not public ones', () => {
    const onboarding = { ...readySession, needsOnboarding: true };
    expect(resolveRedirect('/en/workspaces', 'en', onboarding)).toBe('/en/onboarding');
    expect(resolveRedirect('/en/workspace/ws1', 'en', onboarding)).toBe('/en/onboarding');
    expect(resolveRedirect('/en/help', 'en', onboarding)).toBeNull();
  });

  it('redirects off onboarding when access is available', () => {
    expect(resolveRedirect('/en/onboarding', 'en', readySession)).toBe('/en/forms');
    expect(
      resolveRedirect('/en/onboarding', 'en', {
        ...readySession,
        hasWorkspaces: false,
        canCreateWorkspace: true,
      }),
    ).toBe('/en/workspaces');
  });

  it('waits for session bootstrap before redirecting authenticated users', () => {
    expect(
      resolveRedirect('/en', 'en', {
        ...readySession,
        sessionReady: false,
      }),
    ).toBeNull();
  });
});
