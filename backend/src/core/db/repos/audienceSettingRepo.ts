import { and, count, eq, isNull } from 'drizzle-orm';
import type { Audience } from '@soba/lib';
import { env } from '../../config/env';
import { db, type DbOrTx } from '../client';
import { formAudienceSettings, forms, workspaceAudienceSettings } from '../schema';
import { getIdentityProvider } from './identityProviderRepo';

/** A form's audience row read with its workspace's. `own` is null while the form inherits. */
export interface FormAudienceRow {
  inherit: boolean;
  own: Audience | null;
  workspace: Audience;
}

// The table CHECKs keep mode within the known set and idps empty unless protected.
const toAudience = (mode: string, idps: string[]): Audience => ({ mode, idps }) as Audience;

/**
 * The audience a new workspace starts with: protected by the configured provider when it is an
 * active login provider, otherwise members only.
 */
const defaultWorkspaceAudience = async (): Promise<Audience> => {
  const code = env.getDefaultSubmitterProvider();
  const provider = await getIdentityProvider(code);
  return provider?.isActive && provider.isLoginProvider
    ? { mode: 'protected', idps: [code] }
    : { mode: 'members', idps: [] };
};

/** Creates a new workspace's audience row with the default audience. */
export const createWorkspaceAudienceSetting = async (
  input: { workspaceId: string; actorDisplayLabel: string | null },
  executor: DbOrTx,
): Promise<void> => {
  const audience = await defaultWorkspaceAudience();
  await executor.insert(workspaceAudienceSettings).values({
    workspaceId: input.workspaceId,
    mode: audience.mode,
    idps: audience.idps,
    createdBy: input.actorDisplayLabel,
    updatedBy: input.actorDisplayLabel,
  });
};

/** Creates a new form's audience row: its own audience when given, otherwise inheriting. */
export const createFormAudienceSetting = async (
  input: {
    workspaceId: string;
    formId: string;
    audience?: Audience | null;
    actorDisplayLabel: string | null;
  },
  executor: DbOrTx,
): Promise<void> => {
  await executor.insert(formAudienceSettings).values({
    workspaceId: input.workspaceId,
    formId: input.formId,
    inherit: !input.audience,
    mode: input.audience?.mode ?? null,
    idps: input.audience?.idps ?? null,
    createdBy: input.actorDisplayLabel,
    updatedBy: input.actorDisplayLabel,
  });
};

/** A workspace's audience, or null when the workspace has no row. */
export const findWorkspaceAudience = async (workspaceId: string): Promise<Audience | null> => {
  const rows = await db
    .select({ mode: workspaceAudienceSettings.mode, idps: workspaceAudienceSettings.idps })
    .from(workspaceAudienceSettings)
    .where(eq(workspaceAudienceSettings.workspaceId, workspaceId))
    .limit(1);
  const row = rows[0];
  return row ? toAudience(row.mode, row.idps) : null;
};

/** Writes a workspace's audience; null when the workspace has no row. */
export const updateWorkspaceAudience = async (input: {
  workspaceId: string;
  audience: Audience;
  actorDisplayLabel: string | null;
}): Promise<Audience | null> => {
  const rows = await db
    .update(workspaceAudienceSettings)
    .set({
      mode: input.audience.mode,
      idps: input.audience.idps,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(eq(workspaceAudienceSettings.workspaceId, input.workspaceId))
    .returning({ mode: workspaceAudienceSettings.mode, idps: workspaceAudienceSettings.idps });
  const row = rows[0];
  return row ? toAudience(row.mode, row.idps) : null;
};

/** A form's audience row with its workspace's, or null when either row is missing. */
export const findFormAudience = async (
  workspaceId: string,
  formId: string,
): Promise<FormAudienceRow | null> => {
  const rows = await db
    .select({
      inherit: formAudienceSettings.inherit,
      mode: formAudienceSettings.mode,
      idps: formAudienceSettings.idps,
      workspaceMode: workspaceAudienceSettings.mode,
      workspaceIdps: workspaceAudienceSettings.idps,
    })
    .from(formAudienceSettings)
    .innerJoin(
      workspaceAudienceSettings,
      eq(workspaceAudienceSettings.workspaceId, formAudienceSettings.workspaceId),
    )
    .where(
      and(
        eq(formAudienceSettings.workspaceId, workspaceId),
        eq(formAudienceSettings.formId, formId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    inherit: row.inherit,
    own: row.inherit || row.mode == null ? null : toAudience(row.mode, row.idps ?? []),
    workspace: toAudience(row.workspaceMode, row.workspaceIdps),
  };
};

/** How many live forms in the workspace use its audience rather than their own. */
export const countFormsInheritingAudience = async (workspaceId: string): Promise<number> => {
  const rows = await db
    .select({ count: count() })
    .from(formAudienceSettings)
    .innerJoin(forms, eq(forms.id, formAudienceSettings.formId))
    .where(
      and(
        eq(formAudienceSettings.workspaceId, workspaceId),
        eq(formAudienceSettings.inherit, true),
        isNull(forms.deletedAt),
      ),
    );
  return rows[0]?.count ?? 0;
};

/** The audience that applies to a form: its own, or its workspace's while it inherits. */
export const findEffectiveAudience = async (target: {
  workspaceId: string;
  formId: string;
}): Promise<Audience | null> => {
  const row = await findFormAudience(target.workspaceId, target.formId);
  return row ? (row.own ?? row.workspace) : null;
};

/**
 * Writes a form's audience. A null audience inherits the workspace's and clears the form's own.
 * Returns false when the form has no row in this workspace.
 */
export const updateFormAudience = async (input: {
  workspaceId: string;
  formId: string;
  audience: Audience | null;
  actorDisplayLabel: string | null;
}): Promise<boolean> => {
  const rows = await db
    .update(formAudienceSettings)
    .set({
      inherit: input.audience == null,
      mode: input.audience?.mode ?? null,
      idps: input.audience?.idps ?? null,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(formAudienceSettings.workspaceId, input.workspaceId),
        eq(formAudienceSettings.formId, input.formId),
      ),
    )
    .returning({ id: formAudienceSettings.id });
  return rows.length > 0;
};
