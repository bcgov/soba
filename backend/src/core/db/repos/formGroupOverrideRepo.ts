import { and, eq, notExists, sql, type SQL } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';
import { db, type DbOrTx } from '../client';
import {
  formGroupOverrideMembers,
  formGroupOverrides,
  workspaceGroupMemberships,
  workspaceGroups,
} from '../schema';
import {
  FormGroupOverrideStatus,
  GroupMemberKind,
  WorkspaceGroupMembershipStatus,
  WorkspaceGroupStatus,
  type GroupMemberKindCode,
} from '../codes';

/** A member to write into a form's group override. */
export type OverrideMemberInput =
  | { kind: typeof GroupMemberKind.user; workspaceMembershipId: string }
  | { kind: typeof GroupMemberKind.idp; identityProviderCode: string }
  | { kind: typeof GroupMemberKind.idp_group; idpGroupCode: string };

/**
 * The effective members of a form's groups: each active group's override members when the form has an
 * active override for it, otherwise the workspace group's members. Optional filters narrow both
 * branches to one group, one member kind and/or one workspace membership.
 */
export const effectiveGroupMembers = (args: {
  workspaceId: string;
  formId: string;
  groupId?: string;
  memberKind?: GroupMemberKindCode;
  workspaceMembershipId?: string;
  executor?: DbOrTx;
}) => {
  const executor = args.executor ?? db;

  const inheritedFilters: SQL[] = [
    eq(workspaceGroupMemberships.workspaceId, args.workspaceId),
    eq(workspaceGroupMemberships.status, WorkspaceGroupMembershipStatus.active),
    notExists(
      executor
        .select({ id: formGroupOverrides.id })
        .from(formGroupOverrides)
        .where(
          and(
            eq(formGroupOverrides.formId, args.formId),
            eq(formGroupOverrides.groupId, workspaceGroupMemberships.groupId),
            eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
          ),
        ),
    ),
  ];
  const overrideFilters: SQL[] = [
    eq(formGroupOverrideMembers.status, WorkspaceGroupMembershipStatus.active),
  ];
  if (args.groupId) {
    inheritedFilters.push(eq(workspaceGroupMemberships.groupId, args.groupId));
    overrideFilters.push(eq(formGroupOverrides.groupId, args.groupId));
  }
  if (args.memberKind) {
    inheritedFilters.push(eq(workspaceGroupMemberships.memberKind, args.memberKind));
    overrideFilters.push(eq(formGroupOverrideMembers.memberKind, args.memberKind));
  }
  if (args.workspaceMembershipId) {
    inheritedFilters.push(
      eq(workspaceGroupMemberships.workspaceMembershipId, args.workspaceMembershipId),
    );
    overrideFilters.push(
      eq(formGroupOverrideMembers.workspaceMembershipId, args.workspaceMembershipId),
    );
  }

  const inherited = executor
    .select({
      groupId: workspaceGroupMemberships.groupId,
      memberKind: workspaceGroupMemberships.memberKind,
      workspaceMembershipId: workspaceGroupMemberships.workspaceMembershipId,
      identityProviderCode: workspaceGroupMemberships.identityProviderCode,
      idpGroupCode: workspaceGroupMemberships.idpGroupCode,
    })
    .from(workspaceGroupMemberships)
    .innerJoin(
      workspaceGroups,
      and(
        eq(workspaceGroups.id, workspaceGroupMemberships.groupId),
        eq(workspaceGroups.status, WorkspaceGroupStatus.active),
      ),
    )
    .where(and(...inheritedFilters));

  const overridden = executor
    .select({
      groupId: formGroupOverrides.groupId,
      memberKind: formGroupOverrideMembers.memberKind,
      workspaceMembershipId: formGroupOverrideMembers.workspaceMembershipId,
      identityProviderCode: formGroupOverrideMembers.identityProviderCode,
      idpGroupCode: formGroupOverrideMembers.idpGroupCode,
    })
    .from(formGroupOverrideMembers)
    .innerJoin(
      formGroupOverrides,
      and(
        eq(formGroupOverrides.id, formGroupOverrideMembers.overrideId),
        eq(formGroupOverrides.workspaceId, args.workspaceId),
        eq(formGroupOverrides.formId, args.formId),
        eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
      ),
    )
    .innerJoin(
      workspaceGroups,
      and(
        eq(workspaceGroups.id, formGroupOverrides.groupId),
        eq(workspaceGroups.status, WorkspaceGroupStatus.active),
      ),
    )
    .where(and(...overrideFilters));

  return unionAll(inherited, overridden);
};

/** True when the form has an active override for the group. */
export const hasActiveOverride = async (formId: string, groupId: string): Promise<boolean> => {
  const rows = await db
    .select({ id: formGroupOverrides.id })
    .from(formGroupOverrides)
    .where(
      and(
        eq(formGroupOverrides.formId, formId),
        eq(formGroupOverrides.groupId, groupId),
        eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
      ),
    )
    .limit(1);
  return rows.length > 0;
};

const memberRefs = (member: OverrideMemberInput) => {
  switch (member.kind) {
    case GroupMemberKind.user:
      return { workspaceMembershipId: member.workspaceMembershipId };
    case GroupMemberKind.idp:
      return { identityProviderCode: member.identityProviderCode };
    case GroupMemberKind.idp_group:
      return { idpGroupCode: member.idpGroupCode };
  }
};

/**
 * Sets a form's override of a group to exactly `members`, creating the override when the form has
 * none. The upsert creates or locks the active override in one statement, so concurrent writes for
 * the same form and group apply in turn, and a concurrent clear that commits first leaves this write
 * creating a new override.
 */
export const replaceOverrideMembers = async (args: {
  workspaceId: string;
  formId: string;
  groupId: string;
  members: OverrideMemberInput[];
  displayLabel: string | null;
}): Promise<void> => {
  await db.transaction(async (tx) => {
    const [override] = await tx
      .insert(formGroupOverrides)
      .values({
        id: uuidv7(),
        workspaceId: args.workspaceId,
        formId: args.formId,
        groupId: args.groupId,
        status: FormGroupOverrideStatus.active,
        createdBy: args.displayLabel,
        updatedBy: args.displayLabel,
      })
      .onConflictDoUpdate({
        target: [formGroupOverrides.formId, formGroupOverrides.groupId],
        targetWhere: sql`${formGroupOverrides.status} = 'active'`,
        set: { updatedBy: args.displayLabel, updatedAt: new Date() },
      })
      .returning({ id: formGroupOverrides.id });

    await tx
      .delete(formGroupOverrideMembers)
      .where(eq(formGroupOverrideMembers.overrideId, override.id));
    if (args.members.length) {
      await tx.insert(formGroupOverrideMembers).values(
        args.members.map((member) => ({
          id: uuidv7(),
          workspaceId: args.workspaceId,
          overrideId: override.id,
          memberKind: member.kind,
          ...memberRefs(member),
          status: WorkspaceGroupMembershipStatus.active,
          createdBy: args.displayLabel,
          updatedBy: args.displayLabel,
        })),
      );
    }
  });
};

/** Removes a form's override of a group, so the form inherits the workspace group's members again. */
export const clearOverride = async (args: {
  formId: string;
  groupId: string;
  displayLabel: string | null;
}): Promise<void> => {
  await db.transaction(async (tx) => {
    const [override] = await tx
      .select({ id: formGroupOverrides.id })
      .from(formGroupOverrides)
      .where(
        and(
          eq(formGroupOverrides.formId, args.formId),
          eq(formGroupOverrides.groupId, args.groupId),
          eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
        ),
      )
      .for('update');
    if (!override) return;

    await tx
      .delete(formGroupOverrideMembers)
      .where(eq(formGroupOverrideMembers.overrideId, override.id));
    await tx
      .update(formGroupOverrides)
      .set({
        status: FormGroupOverrideStatus.inactive,
        updatedBy: args.displayLabel,
        updatedAt: new Date(),
      })
      .where(eq(formGroupOverrides.id, override.id));
  });
};
