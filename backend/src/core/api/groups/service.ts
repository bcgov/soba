import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { GroupMemberKind, PUBLIC_PROVIDER_CODE, SystemGroup } from '../../db/codes';
import { GROUP_NAME_TAKEN } from '../../messages';
import { listRoles } from '../../db/repos/roleRepo';
import { getIdentityProvider } from '../../db/repos/identityProviderRepo';
import {
  activeGroupMemberKind,
  addGroupIdpMember,
  addGroupMember,
  countActiveUserMembers,
  countGroupMembers,
  createWorkspaceGroup,
  getWorkspaceGroup,
  getWorkspaceGroupMeta,
  groupNameExistsInWorkspace,
  hasIdpMember,
  isUserInGroup,
  listWorkspaceGroups,
  membershipInWorkspace,
  removeGroupMember,
  renameGroup,
  replaceGroupRoles,
  softDeleteWorkspaceGroup,
  type WorkspaceGroupRow,
} from '../../db/repos/workspaceGroupRepo';

export interface GroupsContextInput {
  workspaceId: string;
  actorDisplayLabel: string | null;
}

export type AddMemberInput = { kind: 'user'; membershipId: string } | { kind: 'idp'; code: string };

const GROUP_NOT_FOUND = 'Group not found';
const PUBLIC_EXCLUSIVE = 'Public access must be the only member of Form submitters';

/** Rejects role codes that don't exist in the catalog (enabled or feature-disabled). */
async function assertRolesExist(roleCodes: string[]): Promise<void> {
  const codes = [...new Set(roleCodes)];
  if (!codes.length) return;
  const found = await listRoles({ code: codes, onlyEnabledFeatures: false });
  const known = new Set(found.map((r) => r.code));
  const missing = codes.filter((c) => !known.has(c));
  if (missing.length) {
    throw new ValidationError(`Unknown role code(s): ${missing.join(', ')}`);
  }
}

/** Asserts the group is active in the workspace and returns its systemCode (null for user-created). */
async function requireGroup(workspaceId: string, groupId: string): Promise<string | null> {
  const meta = await getWorkspaceGroupMeta(workspaceId, groupId);
  if (!meta) {
    throw new NotFoundError(GROUP_NOT_FOUND);
  }
  return meta.systemCode;
}

/** Rejects a name already taken by another active group in the workspace. */
async function assertNameFree(
  workspaceId: string,
  name: string,
  exceptGroupId?: string,
): Promise<void> {
  if (await groupNameExistsInWorkspace(workspaceId, name, exceptGroupId)) {
    throw new ConflictError(GROUP_NAME_TAKEN);
  }
}

async function loadGroup(workspaceId: string, groupId: string): Promise<WorkspaceGroupRow> {
  const group = await getWorkspaceGroup(workspaceId, groupId);
  if (!group) {
    throw new NotFoundError(GROUP_NOT_FOUND);
  }
  return group;
}

export class GroupsApiService {
  async list(workspaceId: string) {
    const items = await listWorkspaceGroups(workspaceId);
    return { items };
  }

  async create(
    ctx: GroupsContextInput,
    input: { name: string; description?: string; roleCodes: string[] },
  ) {
    await assertNameFree(ctx.workspaceId, input.name);
    await assertRolesExist(input.roleCodes);
    const groupId = await createWorkspaceGroup({
      workspaceId: ctx.workspaceId,
      name: input.name,
      description: input.description,
      roleCodes: input.roleCodes,
      displayLabel: ctx.actorDisplayLabel,
    });
    return loadGroup(ctx.workspaceId, groupId);
  }

  async rename(
    ctx: GroupsContextInput,
    groupId: string,
    input: { name?: string; description?: string | null },
  ) {
    await requireGroup(ctx.workspaceId, groupId);
    if (input.name !== undefined) {
      await assertNameFree(ctx.workspaceId, input.name, groupId);
    }
    await renameGroup({
      groupId,
      name: input.name,
      description: input.description,
      displayLabel: ctx.actorDisplayLabel,
    });
    return loadGroup(ctx.workspaceId, groupId);
  }

  async remove(ctx: GroupsContextInput, groupId: string) {
    const systemCode = await requireGroup(ctx.workspaceId, groupId);
    if (systemCode) {
      throw new ConflictError('System groups cannot be deleted');
    }
    await softDeleteWorkspaceGroup({ groupId, displayLabel: ctx.actorDisplayLabel });
  }

  async setRoles(ctx: GroupsContextInput, groupId: string, roleCodes: string[]) {
    const systemCode = await requireGroup(ctx.workspaceId, groupId);
    if (systemCode) {
      throw new ConflictError('System group roles cannot be changed');
    }
    await assertRolesExist(roleCodes);
    await replaceGroupRoles({
      workspaceId: ctx.workspaceId,
      groupId,
      roleCodes,
      displayLabel: ctx.actorDisplayLabel,
    });
    return loadGroup(ctx.workspaceId, groupId);
  }

  async addMember(ctx: GroupsContextInput, groupId: string, input: AddMemberInput) {
    const systemCode = await requireGroup(ctx.workspaceId, groupId);
    if (input.kind === 'idp') {
      await addIdpMember(ctx, groupId, systemCode, input.code);
    } else {
      await addUserMember(ctx, groupId, systemCode, input.membershipId);
    }
    return loadGroup(ctx.workspaceId, groupId);
  }

  async removeMember(ctx: GroupsContextInput, groupId: string, memberId: string) {
    const systemCode = await requireGroup(ctx.workspaceId, groupId);
    // Guard the last admin only when the target is actually an active user member of that group,
    // so a bogus member id still gets a 404 rather than a misleading 409.
    if (systemCode === SystemGroup.form_admins) {
      const kind = await activeGroupMemberKind(groupId, memberId);
      if (kind === GroupMemberKind.user && (await countActiveUserMembers(groupId)) <= 1) {
        throw new ConflictError('Form administrators must keep at least one member');
      }
    }
    const removed = await removeGroupMember({ groupId, memberId });
    if (!removed) {
      throw new NotFoundError('Group member not found');
    }
    return loadGroup(ctx.workspaceId, groupId);
  }
}

/** idp members are Form-submitters-only; `public` is exclusive, other providers must be login-enabled. */
async function addIdpMember(
  ctx: GroupsContextInput,
  groupId: string,
  systemCode: string | null,
  code: string,
): Promise<void> {
  if (systemCode !== SystemGroup.form_submitters) {
    throw new ValidationError('Identity providers can only be assigned to Form submitters');
  }
  const provider = await getIdentityProvider(code);
  if (!provider?.isActive) {
    throw new ValidationError('Unknown identity provider');
  }
  const isPublic = code === PUBLIC_PROVIDER_CODE;
  if (isPublic) {
    // public is exclusive: only allowed as the group's sole member.
    if ((await countGroupMembers(groupId)) > 0) {
      throw new ConflictError(PUBLIC_EXCLUSIVE);
    }
  } else {
    if (!provider.isLoginProvider) {
      throw new ValidationError('This identity provider cannot be assigned');
    }
    if (await hasIdpMember(groupId, PUBLIC_PROVIDER_CODE)) {
      throw new ConflictError(PUBLIC_EXCLUSIVE);
    }
    if (await hasIdpMember(groupId, code)) {
      throw new ConflictError('Provider already assigned');
    }
  }
  await addGroupIdpMember({
    workspaceId: ctx.workspaceId,
    groupId,
    code,
    displayLabel: ctx.actorDisplayLabel,
  });
}

async function addUserMember(
  ctx: GroupsContextInput,
  groupId: string,
  systemCode: string | null,
  membershipId: string,
): Promise<void> {
  if (!(await membershipInWorkspace(ctx.workspaceId, membershipId))) {
    throw new ValidationError('Membership is not an active member of the workspace');
  }
  if (
    systemCode === SystemGroup.form_submitters &&
    (await hasIdpMember(groupId, PUBLIC_PROVIDER_CODE))
  ) {
    throw new ConflictError(PUBLIC_EXCLUSIVE);
  }
  if (await isUserInGroup(groupId, membershipId)) {
    throw new ConflictError('Member already in group');
  }
  await addGroupMember({
    workspaceId: ctx.workspaceId,
    groupId,
    membershipId,
    displayLabel: ctx.actorDisplayLabel,
  });
}

export const groupsApiService = new GroupsApiService();
