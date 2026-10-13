import type { Router } from 'express';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { FeatureCode } from '../../core/db/codes';
import type { RegisterOpenApiPaths } from '../../core/api/shared/openapi';

/** A table a settings group owns. Every one records the workspace its form belongs to. */
export type WorkspaceScopedTable = PgTable & { workspaceId: AnyPgColumn };

/**
 * A self-contained group of form settings, served at /design/forms/:id/settings/<key>. The shared
 * settings router resolves the form and checks the group's feature before the group's routes run.
 */
export interface FormSettingsModule {
  /** URL segment of the group. */
  key: string;
  /** Mount order; lower first. Unrelated to the frontend section weight, which orders the tab. */
  weight: number;
  /** When set, the group's routes 404 unless the feature is available for the form. */
  featureCode?: FeatureCode;
  /** Built when the settings router mounts, so reading the registry costs nothing. */
  router: () => Router;
  registerOpenApi: RegisterOpenApiPaths;
  /** Cleared by dev-data purge before forms are deleted. */
  tables: WorkspaceScopedTable[];
}
