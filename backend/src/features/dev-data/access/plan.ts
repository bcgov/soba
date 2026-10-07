/**
 * The access coverage set: named cases that exist at every size, for checking who may list, open,
 * save and delete what. No DB, no engine, no clock.
 */
import type { Audience } from '@soba/lib';
import type { NormalizedProfile } from '../../../core/auth/jwtClaims';
import {
  Roles,
  SystemGroup,
  WorkspaceMembershipRole,
  type RoleCode,
  type SystemGroupCode,
  type WorkspaceMembershipRoleCode,
} from '../../../core/db/codes';
import { DEV_PREFIX, DEV_SUBJECT_PREFIX } from '../plan';

/** Sorts after the paging anchors and the generated bulk, by name in English and French. */
export const COVERAGE_PREFIX = `${DEV_PREFIX}Zz `;

/** Fixture every coverage form uses. */
export const COVERAGE_FIXTURE_CODE = 'contact';

export const PERSONA_KEYS = [
  'owner',
  'admin',
  'submitter',
  'designer',
  'reviewer',
  'overrideRemoved',
  'overrideAdded',
  'inactiveMember',
  'inactiveGroupMember',
  'outsider',
  'bceidOutsider',
  'collaborator',
  'anonymous',
] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];

/** The real user the data is built around. */
export const OWNER = 'owner' satisfies PersonaKey;

/** The seeded public user, as an anonymous caller. */
export const ANONYMOUS = 'anonymous' satisfies PersonaKey;

/** Owns every coverage workspace, so holds form_admin in each. */
export const ADMIN = 'admin' satisfies PersonaKey;

/** Provider the owner's expectations assume. */
export const OWNER_PROVIDER = 'azureidir';

/** Personas the generator creates: everyone but the owner and the public user. */
export type GeneratedPersonaKey = Exclude<PersonaKey, typeof OWNER | typeof ANONYMOUS>;

export interface PlannedPersona {
  key: GeneratedPersonaKey;
  displayLabel: string;
  subject: string;
  identityProviderCode: string;
  profile: NormalizedProfile;
}

/** A persona's membership in a workspace and the group it gives them. */
export interface PlannedSeat {
  persona: Exclude<PersonaKey, typeof ADMIN>;
  role: WorkspaceMembershipRoleCode;
  group: { system: SystemGroupCode } | { name: string; roleCodes: RoleCode[] } | null;
  membershipStatus?: 'inactive';
  groupMembershipStatus?: 'inactive';
}

export const COVERAGE_WORKSPACE_KEYS = ['roles', 'audience', 'public'] as const;
export type CoverageWorkspaceKey = (typeof COVERAGE_WORKSPACE_KEYS)[number];

export const COVERAGE_FORM_KEYS = [
  'rolesInherit',
  'rolesOverride',
  'rolesOverrideCleared',
  'rolesUnpublished',
  'rolesFormDeleted',
  'rolesVersionDeleted',
  'rolesDraftsOff',
  'protectedInherit',
  'publicOwn',
  'bceidOwn',
  'membersOwn',
  'publicInherit',
  'protectedOwn',
] as const;
export type CoverageFormKey = (typeof COVERAGE_FORM_KEYS)[number];

export interface PlannedCoverageForm {
  key: CoverageFormKey;
  name: string;
  description: string;
  published: boolean;
  /** The form's own audience; absent inherits the workspace's. */
  audience?: Audience;
  /** The form's own drafts setting; absent inherits the workspace's. */
  allowSubmitterDrafts?: boolean;
  /** Replaces the form submitters group's members on this form; cleared leaves it inactive. */
  submitterOverride?: { members: PersonaKey[]; cleared?: boolean };
  /** Applied once the form's submissions exist. */
  then?: 'deleteForm' | 'deleteVersion';
}

export interface PlannedCoverageWorkspace {
  key: CoverageWorkspaceKey;
  name: string;
  org: string;
  useCase: string;
  disclaimerAccepted: boolean;
  audience: Audience;
  allowSubmitterDrafts: boolean;
  /** The admin persona owns every coverage workspace; these are everyone else's memberships. */
  seats: PlannedSeat[];
  forms: PlannedCoverageForm[];
}

export const COVERAGE_SUBMISSION_KEYS = [
  'outsiderDraft',
  'outsiderSubmitted',
  'outsiderOpened',
  'bceidDeleted',
  'submitterOnDeletedVersion',
  'submitterOnDeletedForm',
  'ownerDraft',
  'anonymousSubmitted',
  'anonymousOpened',
] as const;
export type CoverageSubmissionKey = (typeof COVERAGE_SUBMISSION_KEYS)[number];

export interface PlannedCoverageSubmission {
  key: CoverageSubmissionKey;
  form: CoverageFormKey;
  /** Opens it, so holds the owner grant. */
  by: PersonaKey;
  /** Events applied after open, in order. Empty leaves it 'opened'. */
  events: Array<'saved' | 'submitted'>;
  /** Collaborator grants added after the events. */
  collaborators?: Array<{ persona: PersonaKey; status: 'active' | 'inactive' }>;
  /** Deleted by its submitter after the events. */
  deleted?: boolean;
}

export interface CoveragePlan {
  personas: PlannedPersona[];
  workspaces: PlannedCoverageWorkspace[];
  submissions: PlannedCoverageSubmission[];
}

const PERSONA_PROVIDERS: Record<GeneratedPersonaKey, string> = {
  admin: 'azureidir',
  submitter: 'azureidir',
  designer: 'azureidir',
  reviewer: 'azureidir',
  overrideRemoved: 'azureidir',
  overrideAdded: 'azureidir',
  inactiveMember: 'azureidir',
  inactiveGroupMember: 'azureidir',
  outsider: 'azureidir',
  bceidOutsider: 'bceidbusiness',
  collaborator: 'azureidir',
};

const kebab = (key: string): string => key.replaceAll(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function buildPersona(key: GeneratedPersonaKey): PlannedPersona {
  const username = `cov-${kebab(key)}`;
  const displayLabel = `${DEV_PREFIX}${username}`;
  const identityProviderCode = PERSONA_PROVIDERS[key];
  const usernameClaim =
    identityProviderCode === 'bceidbusiness' ? 'bceid_username' : 'idir_username';
  const lastName = kebab(key).replaceAll('-', ' ');
  return {
    key,
    displayLabel,
    subject: `${DEV_SUBJECT_PREFIX}${username}`,
    identityProviderCode,
    profile: {
      displayName: `Coverage ${lastName}`,
      email: `${username}@example.test`,
      preferredUsername: username,
      firstName: 'Coverage',
      lastName,
      name: `Coverage ${lastName}`,
      [usernameClaim]: displayLabel,
      displayLabel,
    },
  };
}

const submitters = (persona: PlannedSeat['persona']): PlannedSeat => ({
  persona,
  role: WorkspaceMembershipRole.member,
  group: { system: SystemGroup.form_submitters },
});

const form = (
  key: CoverageFormKey,
  label: string,
  description: string,
  rest: Partial<PlannedCoverageForm> = {},
): PlannedCoverageForm => ({
  key,
  name: `${COVERAGE_PREFIX}${label}`,
  description,
  published: true,
  ...rest,
});

/** Forms need the disclaimer accepted. */
const WORKSPACE_DEFAULTS = { org: 'CITZ', useCase: 'application', disclaimerAccepted: true };

const ROLES_WORKSPACE: PlannedCoverageWorkspace = {
  key: 'roles',
  name: `${COVERAGE_PREFIX}Coverage Roles`,
  ...WORKSPACE_DEFAULTS,
  audience: { mode: 'members', idps: [] },
  allowSubmitterDrafts: true,
  seats: [
    submitters(OWNER),
    submitters('submitter'),
    {
      persona: 'designer',
      role: WorkspaceMembershipRole.member,
      group: { name: `${COVERAGE_PREFIX}Designers`, roleCodes: [Roles.form_designer] },
    },
    {
      persona: 'reviewer',
      role: WorkspaceMembershipRole.member,
      group: { name: `${COVERAGE_PREFIX}Reviewers`, roleCodes: [Roles.submission_reviewer] },
    },
    submitters('overrideRemoved'),
    { persona: 'overrideAdded', role: WorkspaceMembershipRole.member, group: null },
    { ...submitters('inactiveMember'), membershipStatus: 'inactive' },
    { ...submitters('inactiveGroupMember'), groupMembershipStatus: 'inactive' },
    // The public user's roles never count, even with a seat.
    submitters(ANONYMOUS),
  ],
  forms: [
    form('rolesInherit', 'Roles inherit', 'Members-only audience and drafts on, inherited.'),
    form(
      'rolesOverride',
      'Roles override',
      'Overrides the form submitters group with submitter and overrideAdded.',
      { submitterOverride: { members: ['submitter', 'overrideAdded'] } },
    ),
    form(
      'rolesOverrideCleared',
      'Roles override cleared',
      'Its override of the form submitters group was cleared.',
      { submitterOverride: { members: ['overrideAdded'], cleared: true } },
    ),
    form('rolesUnpublished', 'Roles unpublished', 'Never published.', { published: false }),
    form('rolesFormDeleted', 'Roles form deleted', 'Deleted after a draft was saved.', {
      then: 'deleteForm',
    }),
    form(
      'rolesVersionDeleted',
      'Roles version deleted',
      'Its published version was deleted after a submission.',
      { then: 'deleteVersion' },
    ),
    form('rolesDraftsOff', 'Roles drafts off', 'Turns drafts off for itself.', {
      allowSubmitterDrafts: false,
    }),
  ],
};

const AUDIENCE_WORKSPACE: PlannedCoverageWorkspace = {
  key: 'audience',
  name: `${COVERAGE_PREFIX}Coverage Audience`,
  ...WORKSPACE_DEFAULTS,
  audience: { mode: 'protected', idps: ['azureidir'] },
  allowSubmitterDrafts: false,
  seats: [
    {
      persona: OWNER,
      role: WorkspaceMembershipRole.admin,
      group: { system: SystemGroup.form_admins },
    },
  ],
  forms: [
    form(
      'protectedInherit',
      'Audience protected inherit',
      'IDIR audience and drafts off, inherited.',
    ),
    form('publicOwn', 'Audience public own', 'Its own public audience, drafts on.', {
      audience: { mode: 'public', idps: [] },
      allowSubmitterDrafts: true,
    }),
    form('bceidOwn', 'Audience BCeID own', 'Its own BCeID Business audience, drafts on.', {
      audience: { mode: 'protected', idps: ['bceidbusiness'] },
      allowSubmitterDrafts: true,
    }),
    form('membersOwn', 'Audience members own', 'Its own members-only audience, drafts on.', {
      audience: { mode: 'members', idps: [] },
      allowSubmitterDrafts: true,
    }),
  ],
};

const PUBLIC_WORKSPACE: PlannedCoverageWorkspace = {
  key: 'public',
  name: `${COVERAGE_PREFIX}Coverage Public`,
  ...WORKSPACE_DEFAULTS,
  audience: { mode: 'public', idps: [] },
  allowSubmitterDrafts: true,
  seats: [],
  forms: [
    form('publicInherit', 'Public inherit', 'Public audience and drafts on, inherited.'),
    form('protectedOwn', 'Public protected own', 'Its own IDIR audience, drafts on inherited.', {
      audience: { mode: 'protected', idps: ['azureidir'] },
    }),
  ],
};

const SUBMISSIONS: PlannedCoverageSubmission[] = [
  {
    key: 'outsiderDraft',
    form: 'protectedOwn',
    by: 'outsider',
    events: ['saved'],
    collaborators: [
      { persona: 'collaborator', status: 'active' },
      // Reads it, but the form's IDIR audience refuses the write.
      { persona: 'bceidOutsider', status: 'active' },
    ],
  },
  {
    key: 'outsiderSubmitted',
    form: 'protectedInherit',
    by: 'outsider',
    events: ['submitted'],
    collaborators: [{ persona: 'collaborator', status: 'inactive' }],
  },
  { key: 'outsiderOpened', form: 'publicInherit', by: 'outsider', events: [] },
  { key: 'bceidDeleted', form: 'bceidOwn', by: 'bceidOutsider', events: ['saved'], deleted: true },
  {
    key: 'submitterOnDeletedVersion',
    form: 'rolesVersionDeleted',
    by: 'submitter',
    events: ['submitted'],
  },
  { key: 'submitterOnDeletedForm', form: 'rolesFormDeleted', by: 'submitter', events: ['saved'] },
  { key: 'ownerDraft', form: 'protectedOwn', by: OWNER, events: ['saved'] },
  { key: 'anonymousSubmitted', form: 'publicInherit', by: ANONYMOUS, events: ['submitted'] },
  { key: 'anonymousOpened', form: 'publicInherit', by: ANONYMOUS, events: [] },
];

/** Same output every time. */
export function buildCoveragePlan(): CoveragePlan {
  return {
    personas: (Object.keys(PERSONA_PROVIDERS) as GeneratedPersonaKey[]).map(buildPersona),
    workspaces: [ROLES_WORKSPACE, AUDIENCE_WORKSPACE, PUBLIC_WORKSPACE],
    submissions: SUBMISSIONS,
  };
}
