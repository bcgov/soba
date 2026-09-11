import { boolean, index, integer, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { auditColumns, idColumn } from './audit';
import { sobaSchema } from './core';
import { CODE_SOURCE_CORE } from './codes';

/**
 * Feature status code table. Used by soba.feature.status.
 * Core and features both insert here; source = 'core' or feature code.
 */
export const featureStatus = sobaSchema.table(
  'feature_status',
  {
    code: text('code').notNull(),
    source: text('source').notNull().default(CODE_SOURCE_CORE),
    display: text('display').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.code, table.source] })],
);

/**
 * DB-backed feature registry. status values reference feature_status code table.
 * availability is how the feature is gated: 'fixed' (available wherever platform-enabled) or
 * 'scoped' (available only where a feature_scope grant exists). See FeatureAvailability.
 */
export const features = sobaSchema.table('feature', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version'),
  status: text('status').notNull(),
  availability: text('availability').notNull().default('fixed'),
  ...auditColumns(),
});

/**
 * Grants that make a `scoped` feature available to a specific workspace or form. Workspace and form
 * grants are independent (a form grant applies even when its workspace has none). scope_id is a
 * uuid with no FK because it is polymorphic (workspace.id or form.id, per scope_type).
 */
export const featureScopes = sobaSchema.table(
  'feature_scope',
  {
    id: idColumn(),
    featureCode: text('feature_code')
      .notNull()
      .references(() => features.code),
    scopeType: text('scope_type').notNull(),
    scopeId: uuid('scope_id').notNull(),
    status: text('status').notNull(),
    ...auditColumns(),
  },
  (table) => ({
    codeScopeUnique: uniqueIndex('feature_scope_code_scope_uq').on(
      table.featureCode,
      table.scopeType,
      table.scopeId,
    ),
    scopeIdx: index('feature_scope_scope_idx').on(table.scopeType, table.scopeId),
    codeIdx: index('feature_scope_code_idx').on(table.featureCode),
  }),
);
