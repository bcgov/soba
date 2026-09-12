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
