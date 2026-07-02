import { eq } from 'drizzle-orm';
import { db } from '../client';
import { IdpGroups } from '../codes';
import { idpGroupMembers, idpGroups } from '../schema';

export interface IdpGroupRow {
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

/** Group codes whose membership includes the given identity provider code. */
export const listGroupsForIdp = async (idpCode: string): Promise<string[]> => {
  const normalized = idpCode.trim().toLowerCase();
  if (!normalized) return [];
  const rows = await db
    .select({ groupCode: idpGroupMembers.groupCode })
    .from(idpGroupMembers)
    .where(eq(idpGroupMembers.identityProviderCode, normalized));
  return rows.map((r) => r.groupCode);
};

/** True when the identity provider belongs to the BC Government IDP group. */
export const canCreateWorkspaceByIdp = async (
  idpCode: string | null | undefined,
): Promise<boolean> => {
  const groups = await listGroupsForIdp(idpCode ?? '');
  return groups.includes(IdpGroups.bcgov);
};

/** All IDP groups (for meta / UI). */
export const listGroups = async (): Promise<IdpGroupRow[]> => {
  const rows = await db
    .select({
      code: idpGroups.code,
      name: idpGroups.name,
      description: idpGroups.description,
      isActive: idpGroups.isActive,
    })
    .from(idpGroups)
    .orderBy(idpGroups.code);
  return rows;
};
