import { and, desc, eq, lt, or } from 'drizzle-orm';
import { db } from '../client';
import { features, roleRegistry } from '../schema';

export interface RoleRegistryRow {
  roleCode: string;
  providerType: string;
  featureCode: string | null;
}

export interface ListRoleRegistryInput {
  limit: number;
  afterRoleCode?: string;
  onlyEnabledFeatures?: boolean;
}

export const listRegistry = async (options?: {
  onlyEnabledFeatures?: boolean;
}): Promise<RoleRegistryRow[]> => {
  if (!options?.onlyEnabledFeatures) {
    const rows = await db.select().from(roleRegistry).orderBy(desc(roleRegistry.roleCode));
    return rows;
  }
  const rows = await db
    .select({
      roleCode: roleRegistry.roleCode,
      providerType: roleRegistry.providerType,
      featureCode: roleRegistry.featureCode,
    })
    .from(roleRegistry)
    .leftJoin(features, eq(roleRegistry.featureCode, features.code))
    .where(or(eq(roleRegistry.providerType, 'core'), eq(features.status, 'enabled')))
    .orderBy(desc(roleRegistry.roleCode));
  return rows;
};

export const listRegistryPaginated = async (
  input: ListRoleRegistryInput,
): Promise<{ items: RoleRegistryRow[]; hasMore: boolean }> => {
  const order = desc(roleRegistry.roleCode);
  if (!input.onlyEnabledFeatures) {
    const base = db.select().from(roleRegistry);
    const withWhere = input.afterRoleCode
      ? base.where(lt(roleRegistry.roleCode, input.afterRoleCode))
      : base;
    const rows = await withWhere.orderBy(order).limit(input.limit + 1);
    return {
      items: rows.slice(0, input.limit),
      hasMore: rows.length > input.limit,
    };
  }
  const whereClauses = [or(eq(roleRegistry.providerType, 'core'), eq(features.status, 'enabled'))];
  if (input.afterRoleCode) {
    whereClauses.push(lt(roleRegistry.roleCode, input.afterRoleCode));
  }
  const rows = await db
    .select({
      roleCode: roleRegistry.roleCode,
      providerType: roleRegistry.providerType,
      featureCode: roleRegistry.featureCode,
    })
    .from(roleRegistry)
    .leftJoin(features, eq(roleRegistry.featureCode, features.code))
    .where(and(...whereClauses))
    .orderBy(order)
    .limit(input.limit + 1);
  return {
    items: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
};

export const getByRoleCode = async (roleCode: string): Promise<RoleRegistryRow | null> => {
  const rows = await db
    .select()
    .from(roleRegistry)
    .where(eq(roleRegistry.roleCode, roleCode))
    .limit(1);
  return rows[0] ?? null;
};
