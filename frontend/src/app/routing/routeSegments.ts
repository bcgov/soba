import type { RouteKind } from './appRoutePolicy';

// Single literal for the repeated kind so the map below doesn't duplicate it per segment.
const WORKSPACE_APP: RouteKind = 'workspace-app';

/**
 * Single source of truth mapping each top-level route segment (the folder directly under
 * `app/[lang]/`) to how the access guard treats it. This lives next to the routes it
 * describes: when you add an `app/[lang]/<segment>` route, add its entry here in the same
 * change so the guard never drifts from the actual route tree.
 *
 * Any segment not listed here falls through to `'public'`.
 */
export const ROUTE_KIND_BY_SEGMENT: Readonly<Record<string, RouteKind>> = {
  onboarding: 'onboarding', // app/[lang]/onboarding
  forms: WORKSPACE_APP, // app/[lang]/forms
  designer: WORKSPACE_APP, // app/[lang]/designer
  form: WORKSPACE_APP, // app/[lang]/form
  submissions: WORKSPACE_APP, // app/[lang]/submissions
  submission: WORKSPACE_APP, // app/[lang]/submission
  workspaces: 'workspaces', // app/[lang]/workspaces
  workspace: 'workspaces', // app/[lang]/workspace
};
