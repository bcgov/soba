import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { db } from '../client';

/** How a save of a settings row ended. `conflict` means the row moved on since the caller read it. */
export type SettingsSaveStatus = 'saved' | 'notFound' | 'conflict';

type VersionedTable = PgTable & { id: AnyPgColumn; version: AnyPgColumn };

/**
 * Writes `set` to the settings row `where` selects and moves its version on, but only while its
 * version is still `version`. Without a version the row is written whatever its version, which only
 * internal callers do.
 */
export const saveSettingsRow = async <T extends VersionedTable>(
  table: T,
  where: SQL,
  set: PgUpdateSetSource<T>,
  version?: number,
): Promise<SettingsSaveStatus> => {
  const rows = await db
    .update(table)
    .set({ ...set, version: sql`${table.version} + 1` } as PgUpdateSetSource<T>)
    .where(version === undefined ? where : and(where, eq(table.version, version)))
    .returning({ id: table.id });
  if (rows.length > 0) return 'saved';
  const found = await db
    .select({ id: table.id })
    .from(table as PgTable)
    .where(where)
    .limit(1);
  return found.length > 0 ? 'conflict' : 'notFound';
};
