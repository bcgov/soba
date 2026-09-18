import type {
  FormSubmitterAudience,
  SetFormSubmitterAudienceBody,
  SubmitterAudience,
} from '@soba/lib';
import { GroupMemberKind, PUBLIC_PROVIDER_CODE } from '../../db/codes';
import {
  clearOverride,
  effectiveGroupMembers,
  hasActiveOverride,
  replaceOverrideMembers,
  type OverrideMemberInput,
} from '../../db/repos/formGroupOverrideRepo';
import {
  assertLoginProviders,
  readAudience,
  requireSubmittersGroupId,
} from '../groups/submitterAudience';
import type { CoreRequestContext } from '../../middleware/requestContext';

type FormAudienceContext = Pick<CoreRequestContext, 'workspaceId' | 'actorDisplayLabel'>;

async function readFormAudience(
  workspaceId: string,
  formId: string,
  groupId: string,
): Promise<FormSubmitterAudience> {
  const [{ available, ...workspace }, overridden] = await Promise.all([
    readAudience(workspaceId, groupId),
    hasActiveOverride(formId, groupId),
  ]);
  if (!overridden) {
    return { inherit: true, mode: workspace.mode, idps: workspace.idps, available, workspace };
  }

  const members = await effectiveGroupMembers({
    workspaceId,
    formId,
    groupId,
    memberKind: GroupMemberKind.idp,
  });
  const codes = members.map((m) => m.identityProviderCode).filter((c): c is string => c != null);
  // Ordered by provider name, as the workspace audience lists them.
  const nameOf = (code: string) => available.find((p) => p.code === code)?.name ?? code;
  const idps = codes
    .filter((c) => c !== PUBLIC_PROVIDER_CODE)
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  let mode: SubmitterAudience['mode'] = 'none';
  if (codes.includes(PUBLIC_PROVIDER_CODE)) mode = 'public';
  else if (idps.length) mode = 'protected';
  return { inherit: false, mode, idps, available, workspace };
}

const idpMembers = (codes: string[]): OverrideMemberInput[] =>
  codes.map((code) => ({ kind: GroupMemberKind.idp, identityProviderCode: code }));

/** A form's Form submitters audience: inherited from the workspace, or the form's own override. */
export const formSubmitterAudienceService = {
  async get(ctx: FormAudienceContext, formId: string): Promise<FormSubmitterAudience> {
    const groupId = await requireSubmittersGroupId(ctx.workspaceId);
    return readFormAudience(ctx.workspaceId, formId, groupId);
  },

  async set(
    ctx: FormAudienceContext,
    formId: string,
    input: SetFormSubmitterAudienceBody,
  ): Promise<FormSubmitterAudience> {
    const groupId = await requireSubmittersGroupId(ctx.workspaceId);
    const target = { workspaceId: ctx.workspaceId, formId, groupId };
    if (input.mode === 'inherit') {
      await clearOverride({ formId, groupId, displayLabel: ctx.actorDisplayLabel });
    } else {
      const codes = input.mode === 'public' ? [PUBLIC_PROVIDER_CODE] : [...new Set(input.idps)];
      if (input.mode === 'protected') await assertLoginProviders(codes);
      await replaceOverrideMembers({
        ...target,
        members: idpMembers(codes),
        displayLabel: ctx.actorDisplayLabel,
      });
    }
    return readFormAudience(ctx.workspaceId, formId, groupId);
  },
};
