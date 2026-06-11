import { eq } from 'drizzle-orm';
import { db } from '../client';
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
