import { and, eq } from 'drizzle-orm';
import { db } from '../../client';
import { enterpriseWorkspaceBindings } from '../../schema';

export const findWorkspaceByEnterpriseExternalId = async (
  providerCode: string,
  externalWorkspaceId: string,
) => {
  const row = await db
    .select({ workspaceId: enterpriseWorkspaceBindings.workspaceId })
    .from(enterpriseWorkspaceBindings)
    .where(
      and(
        eq(enterpriseWorkspaceBindings.providerCode, providerCode),
        eq(enterpriseWorkspaceBindings.externalWorkspaceId, externalWorkspaceId),
        eq(enterpriseWorkspaceBindings.status, 'active'),
      ),
    )
    .limit(1);

  return row[0]?.workspaceId ?? null;
};
