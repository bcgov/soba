import { sobaFetch } from '@/src/shared/api/sobaFetch';
import { parseJson } from '@/src/shared/api/sobaHelpers';
import { sortLocaleHeaders, sortLocaleRequest } from '@/src/shared/api/sortLocaleRequest';
import { toListRequestQuery, type ListQueryArgs } from '@/src/types/list';
import type {
  AddFormTeamMemberBody,
  FormTeamGroups,
  FormTeamResponse,
  TeamMember,
} from '@/src/types/formTeam';
import type { SortLocale } from '@soba/lib/sort';

const teamPath = (formId: string) => `/design/forms/${formId}/team`;
const memberPath = (formId: string, membershipId: string) => `${teamPath(formId)}/${membershipId}`;

/** One page of the form's team with each member's groups on the form, by name. */
export async function listFormTeam(
  token: string,
  formId: string,
  args: ListQueryArgs,
): Promise<FormTeamResponse> {
  const response = await sobaFetch(teamPath(formId), {
    token,
    query: toListRequestQuery(args),
    headers: sortLocaleHeaders(args.locale),
  });
  return parseJson(response);
}

/** The groups a team member can be put in. */
export async function listFormTeamGroups(
  token: string,
  formId: string,
  locale: SortLocale,
): Promise<FormTeamGroups> {
  const response = await sobaFetch(`${teamPath(formId)}/groups`, {
    token,
    ...sortLocaleRequest(locale),
  });
  return parseJson(response);
}

export async function addFormTeamMember(
  token: string,
  formId: string,
  body: AddFormTeamMemberBody,
): Promise<TeamMember> {
  const response = await sobaFetch(teamPath(formId), { token, method: 'POST', json: body });
  return parseJson(response);
}

export async function setFormTeamGroups(
  token: string,
  formId: string,
  membershipId: string,
  groupIds: string[],
): Promise<TeamMember> {
  const response = await sobaFetch(`${memberPath(formId, membershipId)}/groups`, {
    token,
    method: 'PUT',
    json: { groupIds },
  });
  return parseJson(response);
}

/** A 404 counts as removed: the member is off the team either way. */
export async function removeFormTeamMember(
  token: string,
  formId: string,
  membershipId: string,
): Promise<void> {
  const response = await sobaFetch(memberPath(formId, membershipId), {
    token,
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 404) await parseJson(response);
}
