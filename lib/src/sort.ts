// No zod import: the frontend shell takes these through `@soba/lib/sort` without the schemas.

export type SortToken<TField extends string> = `${TField}:asc` | `${TField}:desc`;

export const sortTokensFor = <TField extends string>(
  fields: readonly TField[],
): SortToken<TField>[] =>
  fields.flatMap((field) => [`${field}:asc`, `${field}:desc`] as SortToken<TField>[]);

export const FORM_SORT_FIELDS = ['name', 'status', 'createdAt', 'updatedAt'] as const;

export const FORM_VERSION_SORT_FIELDS = ['versionNo', 'state', 'createdAt', 'updatedAt'] as const;

export const SUBMISSION_SORT_FIELDS = [
  'formName',
  'submittedAt',
  'createdAt',
  'updatedAt',
] as const;

export const WORKSPACE_SORT_FIELDS = ['name', 'kind', 'status', 'updatedAt'] as const;

export const SOBA_ADMIN_SORT_FIELDS = ['displayLabel', 'source', 'syncedAt'] as const;

export const FEATURE_SCOPE_SORT_FIELDS = [
  'featureCode',
  'scopeType',
  'status',
  'createdAt',
  'updatedAt',
] as const;

export const DOCGEN_AUDIT_SORT_FIELDS = ['createdAt', 'outcome', 'durationMs'] as const;

export type SortDirection = 'asc' | 'desc';

export interface TextSortRules {
  /** Fold to lower case before comparing, matching a DB `lower(col)` sort. */
  caseInsensitive?: boolean;
  /** Missing values sort last in both directions. */
  nullable?: boolean;
}

/**
 * Order two text values for one sort field the way the backend `orderByForSort` does, so a
 * client-resolved list matches a server-paged one. Compares by code unit, not `Intl.Collator`: the
 * `en_US.utf8` database orders accents (e vs e-acute, a-ring) by code point, and EN/FR data has
 * accents, so a locale comparator would order them differently from the DB.
 */
export function compareTextForSort(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: SortDirection,
  rules: TextSortRules = {},
): number {
  const aMissing = a == null;
  const bMissing = b == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  const av = rules.caseInsensitive ? a.toLowerCase() : a;
  const bv = rules.caseInsensitive ? b.toLowerCase() : b;
  let cmp = 0;
  if (av < bv) cmp = -1;
  else if (av > bv) cmp = 1;
  return direction === 'desc' ? -cmp : cmp;
}

/**
 * Whether a value contains the search term, matching the backend `ilike(col, '%term%')`: case
 * insensitive, and literal (the DB escapes `%` and `_`, and a substring test never reads them as
 * wildcards). An empty term matches everything; a missing value matches nothing.
 */
export function matchesSearchTerm(value: string | null | undefined, term: string): boolean {
  if (term === '') return true;
  if (value == null) return false;
  return value.toLowerCase().includes(term.toLowerCase());
}
