/**
 * Cache key builders for consistent naming. Use these when caching and invalidating.
 */
export function membershipKey(workspaceId: string, userId: string): string {
  return `membership:${workspaceId}:${userId}`;
}
