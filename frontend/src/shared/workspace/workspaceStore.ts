/**
 * Per-tab workspace persistence. Backed by sessionStorage so the value survives a
 * refresh, stays independent per browser tab, and is cleared when the tab closes.
 *
 * This module is the only place that reads/writes the stored workspace id. The Redux
 * `workspace.activeWorkspaceId` is a reactive mirror hydrated from here on load and
 * kept in sync by `sobaFetch` when the backend echoes the resolved workspace.
 */
const STORAGE_KEY = 'soba.workspaceId';

function getStorage(): Storage | null {
  if (typeof globalThis.window === 'undefined') return null;
  try {
    return globalThis.sessionStorage;
  } catch {
    // Access to sessionStorage can throw (e.g. sandboxed iframes, privacy modes).
    return null;
  }
}

export function getWorkspaceId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setWorkspaceId(workspaceId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, workspaceId);
  } catch {
    // Ignore write failures; the Redux mirror still reflects the value for this session.
  }
}

export function clearWorkspaceId(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
