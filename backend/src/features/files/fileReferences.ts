/**
 * Collect the ids of chefs-stored files referenced in a submission's data. BC File Upload values
 * look like `{ storage: 'chefs', id, ... }` (usually in arrays), so we walk the data for them. Deduped.
 */
export function extractChefsFileIds(data: unknown): string[] {
  const ids = new Set<string>();

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (obj.storage === 'chefs' && typeof obj.id === 'string' && obj.id) {
        ids.add(obj.id);
      }
      Object.values(obj).forEach(visit);
    }
  };

  visit(data);
  return [...ids];
}
