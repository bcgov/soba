import { NotFoundError, ValidationError } from '../../errors';
import { PUBLIC_PROVIDER_CODE, SystemGroup } from '../../db/codes';
import { listLoginIdentityProviders } from '../../db/repos/identityProviderRepo';
import {
  getSystemGroupId,
  getWorkspaceGroup,
  setSubmitterAudience,
} from '../../db/repos/workspaceGroupRepo';
import type { GroupsContextInput } from './service';

export type AudienceMode = 'public' | 'protected' | 'none';

export interface SubmitterAudience {
  mode: AudienceMode;
  idps: string[];
  users: { membershipId: string; displayLabel: string | null }[];
  available: { code: string; name: string }[];
}

export type SetAudienceInput = { mode: 'public' } | { mode: 'protected'; idps: string[] };

const SUBMITTERS_NOT_FOUND = 'Form submitters group not found';

async function requireSubmittersGroupId(workspaceId: string): Promise<string> {
  const id = await getSystemGroupId(workspaceId, SystemGroup.form_submitters);
  if (!id) throw new NotFoundError(SUBMITTERS_NOT_FOUND);
  return id;
}

async function readAudience(workspaceId: string, groupId: string): Promise<SubmitterAudience> {
  const group = await getWorkspaceGroup(workspaceId, groupId);
  const members = group?.members ?? [];
  const idps: string[] = [];
  const users: SubmitterAudience['users'] = [];
  let isPublic = false;
  for (const m of members) {
    if (m.kind === 'user') {
      users.push({ membershipId: m.membershipId, displayLabel: m.displayLabel });
    } else if (m.code === PUBLIC_PROVIDER_CODE) {
      isPublic = true;
    } else {
      idps.push(m.code);
    }
  }
  let mode: AudienceMode = 'none';
  if (isPublic) mode = 'public';
  else if (idps.length || users.length) mode = 'protected';
  return { mode, idps, users, available: await listLoginIdentityProviders() };
}

/** Rejects codes that aren't active login providers (also excludes `public`/`system`). */
async function assertLoginProviders(codes: string[]): Promise<void> {
  const valid = new Set((await listLoginIdentityProviders()).map((p) => p.code));
  const bad = [...new Set(codes)].filter((c) => !valid.has(c));
  if (bad.length) {
    throw new ValidationError(`Not assignable login providers: ${bad.join(', ')}`);
  }
}

export const submitterAudienceService = {
  async get(ctx: GroupsContextInput): Promise<SubmitterAudience> {
    const groupId = await requireSubmittersGroupId(ctx.workspaceId);
    return readAudience(ctx.workspaceId, groupId);
  },

  async set(ctx: GroupsContextInput, input: SetAudienceInput): Promise<SubmitterAudience> {
    const groupId = await requireSubmittersGroupId(ctx.workspaceId);
    if (input.mode === 'public') {
      await setSubmitterAudience({
        workspaceId: ctx.workspaceId,
        groupId,
        public: true,
        idps: [],
        displayLabel: ctx.actorDisplayLabel,
      });
      return readAudience(ctx.workspaceId, groupId);
    }

    const idps = [...new Set(input.idps)];
    await assertLoginProviders(idps);
    const group = await getWorkspaceGroup(ctx.workspaceId, groupId);
    const userCount = group?.members.filter((m) => m.kind === 'user').length ?? 0;
    // protected = at least one principal: a login provider or an existing direct user.
    if (idps.length + userCount === 0) {
      throw new ValidationError('Protected access needs at least one provider or user');
    }
    await setSubmitterAudience({
      workspaceId: ctx.workspaceId,
      groupId,
      public: false,
      idps,
      displayLabel: ctx.actorDisplayLabel,
    });
    return readAudience(ctx.workspaceId, groupId);
  },
};
