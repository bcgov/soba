/**
 * Simple deep-equality check for JSON-serializable values.
 * Handles objects, arrays, primitives, null, and undefined — the types
 * found in Form.io submission data.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return arraysEqual(a, b as unknown[]);
  return objectsEqual(a as Record<string, unknown>, b as Record<string, unknown>);
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => deepEqual(item, b[i]));
}

function objectsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]))
  );
}
