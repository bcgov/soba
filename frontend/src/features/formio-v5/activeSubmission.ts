/**
 * Per-tab persistence of the submission id currently being filled, so the CHEFS storage provider can
 * tag uploads with it (the backend derives the workspace from that submission and authorizes against
 * it). Backed by sessionStorage — survives a refresh, is independent per tab, and clears on tab close.
 * The fill page sets it on mount and clears it on unmount; the provider reads it per upload.
 */
const STORAGE_KEY = 'soba.submissionId';

function getStorage(): Storage | null {
  if (!('window' in globalThis)) return null;
  try {
    return globalThis.sessionStorage;
  } catch {
    // Access to sessionStorage can throw (e.g. sandboxed iframes, privacy modes).
    return null;
  }
}

export function getActiveSubmissionId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveSubmissionId(submissionId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, submissionId);
  } catch {
    // Ignore write failures.
  }
}

export function clearActiveSubmissionId(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
