jest.mock('../../../../src/core/db/client', () => ({ db: { transaction: jest.fn() } }));
jest.mock('../../../../src/core/db/repos/formTeamRepo', () => ({
  lockFormTeam: jest.fn(),
  listTeamGroups: jest.fn(),
  listFormTeamPeople: jest.fn(),
  readTeamGroups: jest.fn(),
  readTeamPeople: jest.fn(),
  findActiveTeamMembership: jest.fn(),
  ensureTeamMembership: jest.fn(),
  writeTeamGroups: jest.fn(),
}));
import { db } from '../../../../src/core/db/client';
import {
  changeTeamGroups,
  formTeamService,
  teamMembers,
} from '../../../../src/core/api/form-team/service';
import * as repo from '../../../../src/core/db/repos/formTeamRepo';
import type { FormTeamContext } from '../../../../src/core/api/form-team/service';

const ctx: FormTeamContext = {
  workspaceId: 'ws1',
  formId: 'f1',
  actorDisplayLabel: 'Owner',
  permissions: new Set(['*']),
};
const person = {
  membershipId: 'm1',
  userId: 'u1',
  displayLabel: 'Jane',
  profile: { displayName: 'Jane Doe', email: 'jane@example.com' },
};
const groups: repo.TeamGroupState[] = [
  {
    id: 'admins',
    name: 'Administrators',
    roles: ['form_admin'],
    members: [{ kind: 'user', workspaceMembershipId: 'owner-member' }],
  },
  {
    id: 'designers',
    name: 'Designers',
    roles: ['form_designer'],
    members: [
      { kind: 'user', workspaceMembershipId: 'other-member' },
      { kind: 'idp', identityProviderCode: 'idir' },
    ],
  },
];
const input = { membershipId: 'm1', groups: ['designers'] };
const tx = {} as never;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(db.transaction).mockImplementation(async (fn) => fn(tx));
  jest.mocked(repo.readTeamGroups).mockResolvedValue(groups);
  jest
    .mocked(repo.readTeamPeople)
    .mockResolvedValue([person, { ...person, membershipId: 'owner-member', userId: 'owner' }]);
  jest
    .mocked(repo.findActiveTeamMembership)
    .mockResolvedValue({ membershipId: 'm1', userId: 'u1' });
});

describe('form team assignments', () => {
  it('adds a Soba user outside the workspace through a basic membership', async () => {
    jest.mocked(repo.ensureTeamMembership).mockResolvedValue({ membershipId: 'm1', userId: 'u1' });
    const added = await formTeamService.add(ctx, { userId: 'u1', groups: ['designers'] });
    expect(repo.ensureTeamMembership).toHaveBeenCalledWith('ws1', 'u1', 'Owner', tx);
    expect(repo.findActiveTeamMembership).not.toHaveBeenCalled();
    expect(added.id).toBe('u1');
  });

  it('rejects an inactive or missing Soba user before changing form access', async () => {
    jest.mocked(repo.ensureTeamMembership).mockResolvedValue(null);
    await expect(formTeamService.add(ctx, { userId: 'u1', groups: ['designers'] })).rejects.toThrow(
      'not an active member',
    );
    expect(repo.writeTeamGroups).not.toHaveBeenCalled();
  });

  it('loads group options without reading their memberships', async () => {
    jest.mocked(repo.listTeamGroups).mockResolvedValue([
      { id: 'submitters', name: 'Submitters' },
      { id: 'admins', name: 'Administrators' },
    ]);
    expect(await formTeamService.groups(ctx, 'en')).toEqual({
      items: [
        { id: 'admins', name: 'Administrators' },
        { id: 'submitters', name: 'Submitters' },
      ],
    });
    expect(repo.listTeamGroups).toHaveBeenCalledWith('ws1');
    expect(repo.readTeamGroups).not.toHaveBeenCalled();
  });

  it('adds just one member while preserving inherited users and identity grants', () => {
    const next = changeTeamGroups(
      groups,
      'm1',
      ['designers'],
      new Set(['team_update']),
      new Set(['owner-member', 'm1']),
    );
    expect(next).toEqual([
      {
        ...groups[1],
        members: [...groups[1].members, { kind: 'user', workspaceMembershipId: 'm1' }],
      },
    ]);
    expect(groups[1].members).toHaveLength(2);
  });

  it('rejects foreign groups and prevents a team manager granting form administration', () => {
    expect(() => changeTeamGroups(groups, 'm1', ['foreign'], new Set(['*']), new Set())).toThrow(
      'not active in this workspace',
    );
    expect(() =>
      changeTeamGroups(groups, 'm1', ['admins'], new Set(['team_update']), new Set()),
    ).toThrow('Only form administrators');
  });

  it('keeps the last active administrator, even if inactive memberships remain', () => {
    const source = [
      {
        ...groups[0],
        members: [
          ...groups[0].members,
          { kind: 'user' as const, workspaceMembershipId: 'inactive' },
        ],
      },
    ];
    expect(() =>
      changeTeamGroups(source, 'owner-member', [], new Set(['*']), new Set(['owner-member'])),
    ).toThrow('at least one active member');
  });

  it('projects only effective active users, with groups rather than profile roles', () => {
    const changed = changeTeamGroups(
      groups,
      'm1',
      ['designers'],
      new Set(['*']),
      new Set(['owner-member', 'm1']),
    );
    expect(teamMembers(changed, [person])).toEqual([
      { id: 'u1', name: 'Jane Doe', email: 'jane@example.com', groups: ['designers'] },
    ]);
  });

  it('adds only form groups for an existing active workspace membership', async () => {
    const result = await formTeamService.add(ctx, input);
    expect(repo.findActiveTeamMembership).toHaveBeenCalledWith('ws1', 'm1', tx);
    expect(repo.writeTeamGroups).toHaveBeenCalledWith(
      'ws1',
      'f1',
      expect.arrayContaining([expect.objectContaining({ id: 'designers' })]),
      'Owner',
      tx,
    );
    expect(result.id).toBe('u1');
    expect(result.groups).toEqual(['designers']);
  });

  it('refuses a membership outside the active workspace members before changing form groups', async () => {
    jest.mocked(repo.findActiveTeamMembership).mockResolvedValue(null);
    await expect(formTeamService.add(ctx, input)).rejects.toThrow(
      'not an active member of this workspace',
    );
    expect(repo.writeTeamGroups).not.toHaveBeenCalled();
  });

  it('rejects a duplicate without writing overrides', async () => {
    jest
      .mocked(repo.readTeamGroups)
      .mockResolvedValue([
        { ...groups[1], members: [{ kind: 'user', workspaceMembershipId: 'm1' }] },
      ]);
    await expect(formTeamService.add(ctx, input)).rejects.toThrow('already on the form team');
    expect(repo.writeTeamGroups).not.toHaveBeenCalled();
  });

  it('requests a scoped page of candidates and returns only candidate fields', async () => {
    jest.mocked(repo.listFormTeamPeople).mockResolvedValue({
      items: [
        { id: 'u1', membershipId: 'm1', name: 'Jane Doe', email: 'jane@example.com', groups: [] },
      ],
      total: 1,
    });
    const query = { offset: 0, limit: 25, sort: 'name:asc' as const, q: 'jane@example' };
    expect(await formTeamService.candidates(ctx, query, 'en')).toEqual({
      items: [{ id: 'u1', membershipId: 'm1', name: 'Jane Doe', email: 'jane@example.com' }],
      page: { offset: 0, limit: 25, total: 1 },
    });
    expect(repo.listFormTeamPeople).toHaveBeenCalledWith({
      ...query,
      workspaceId: 'ws1',
      formId: 'f1',
      locale: 'en',
      candidates: true,
    });
  });

  it('removes only form assignments, preserving other users and workspace membership', async () => {
    jest.mocked(repo.readTeamGroups).mockResolvedValue([
      {
        ...groups[1],
        members: [...groups[1].members, { kind: 'user', workspaceMembershipId: 'm1' }],
      },
    ]);
    await formTeamService.setGroups(ctx, 'u1', []);
    expect(repo.writeTeamGroups).toHaveBeenCalledWith('ws1', 'f1', [{ ...groups[1] }], 'Owner', tx);
    expect(repo.findActiveTeamMembership).not.toHaveBeenCalled();
  });
});
