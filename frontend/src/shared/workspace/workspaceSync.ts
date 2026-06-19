/**
 * Decouples `sobaFetch` (a plain module) from the Redux store. When the backend echoes
 * the resolved workspace, `sobaFetch` notifies here; the app registers a listener (in
 * AppProviders) that mirrors the value into Redux. This avoids an import cycle between
 * the API client, the store, and the workspace slice.
 */
type WorkspaceResolvedListener = (workspaceId: string) => void;

let listener: WorkspaceResolvedListener | null = null;

export function setWorkspaceResolvedListener(next: WorkspaceResolvedListener | null): void {
  listener = next;
}

export function notifyWorkspaceResolved(workspaceId: string): void {
  listener?.(workspaceId);
}
