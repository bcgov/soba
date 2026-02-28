import { eq } from 'drizzle-orm';
import { db } from '../../client';
import { personalWorkspaceSettings } from '../../schema';

export const getPersonalWorkspaceSettings = async (workspaceId: string) => {
  const row = await db
    .select()
    .from(personalWorkspaceSettings)
    .where(eq(personalWorkspaceSettings.workspaceId, workspaceId))
    .limit(1);

  return row[0] ?? null;
};
