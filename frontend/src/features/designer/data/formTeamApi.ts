import type { SortLocale } from '@soba/lib';
import { sobaFetch } from '@/src/shared/api/sobaFetch';
import { parseJson } from '@/src/shared/api/sobaHelpers';
import type { TeamGroup, TeamMember, TeamCandidate } from '@/src/types/formTeam';
import { toListRequestQuery, type ListQueryArgs, type OffsetPage } from '@/src/types/list';

const pathOf = (formId: string) => `/design/forms/${encodeURIComponent(formId)}/team`;

export async function fetchFormTeam(token: string, formId: string, query: ListQueryArgs) {
  return parseJson<{ items: TeamMember[]; page: OffsetPage }>(
    await sobaFetch(pathOf(formId), {
      token,
      query: toListRequestQuery({ ...query, q: query.q?.trim() }),
    }),
  );
}

export async function fetchTeamGroups(token: string, formId: string, locale: SortLocale) {
  return parseJson<{ items: TeamGroup[] }>(
    await sobaFetch(`${pathOf(formId)}/groups`, { token, query: { locale } }),
  );
}

export async function fetchTeamCandidates(
  token: string,
  formId: string,
  q: string,
  locale: SortLocale,
) {
  return parseJson<{ items: TeamCandidate[]; page: OffsetPage }>(
    await sobaFetch(`${pathOf(formId)}/candidates`, {
      token,
      query: toListRequestQuery({ offset: 0, limit: 25, sort: 'name:asc', q: q.trim(), locale }),
    }),
  );
}

export async function addTeamMember(
  token: string,
  formId: string,
  membershipId: string | null,
  groups: string[],
  userId?: string,
) {
  return parseJson<TeamMember>(
    await sobaFetch(pathOf(formId), {
      token,
      method: 'POST',
      json: membershipId ? { membershipId, groups } : { userId, groups },
    }),
  );
}

export async function setTeamMemberGroups(
  token: string,
  formId: string,
  userId: string,
  groups: string[],
) {
  return parseJson<TeamMember>(
    await sobaFetch(`${pathOf(formId)}/${encodeURIComponent(userId)}/groups`, {
      token,
      method: 'PUT',
      json: { groups },
    }),
  );
}

export async function removeTeamMember(token: string, formId: string, userId: string) {
  await sobaFetch(`${pathOf(formId)}/${encodeURIComponent(userId)}`, { token, method: 'DELETE' });
}
