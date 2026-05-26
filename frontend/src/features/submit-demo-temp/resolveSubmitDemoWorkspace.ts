/**
 * TEMP(submit-demo): pick workspace for Submit demo API calls.
 * Prefer personal workspaces (stable id ascending); else first membership by id ascending.
 */
import type { WorkspaceItem } from '@/src/shared/api/sobaApi';

export function resolveSubmitDemoWorkspaceId(items: WorkspaceItem[]): string | null {
  if (items.length === 0) return null;
  const byId = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const personal = byId.filter((w) => w.kind === 'personal');
  return (personal[0] ?? byId[0]).id;
}
