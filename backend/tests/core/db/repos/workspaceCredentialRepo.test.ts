jest.mock('../../../../src/core/db/client', () => {
  const { drizzle } = jest.requireActual('drizzle-orm/node-postgres');
  const client = { query: jest.fn() };
  return { db: drizzle(client) };
});
import { db } from '../../../../src/core/db/client';
import {
  getWorkspaceCredential,
  listWorkspaceCredentials,
  reserveWorkspaceCredential,
  updateCredentialNotes,
} from '../../../../src/core/db/repos/workspaceCredentialRepo';

const query = jest.mocked(db.$client.query);
const empty = { rows: [], rowCount: 0 };
const calls = () =>
  query.mock.calls.map(([config, params]) => ({
    sql: typeof config === 'string' ? config : (config as { text: string }).text,
    params,
  }));

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue(empty as never);
});

describe('credential ownership and type persistence', () => {
  it('pages and counts the same form scope and literal search in one snapshot', async () => {
    await listWorkspaceCredentials(
      'workspace',
      { offset: 10, limit: 5, sort: 'label:asc', q: 'a_%', locale: 'fr' },
      'form',
    );
    const statements = calls();
    expect(statements[0].sql).toContain('repeatable read');
    expect(statements[0].sql).toContain('read only');
    const [page, total] = statements.filter(({ sql }) => sql.startsWith('select'));
    for (const statement of [page, total]) {
      expect(statement.sql).toContain('"workspace_id" =');
      expect(statement.sql).toContain('"form_id" =');
      expect(statement.params).toEqual(expect.arrayContaining(['workspace', 'form', '%a\\_\\%%']));
    }
    expect(page.sql).toContain('collate "fr-CA-x-icu" asc');
    expect(page.sql).toContain('limit');
    expect(page.sql).toContain('offset');
    expect(page.params).toEqual(expect.arrayContaining([5, 10]));
    expect(total.sql).toContain('count(*)');
    expect(statements.at(-1)?.sql).toBe('commit');
  });
  it('keeps workspace reads separate from every form collection', async () => {
    await listWorkspaceCredentials('workspace', {
      offset: 0,
      limit: 20,
      sort: 'createdAt:desc',
      locale: 'en',
    });
    expect(calls()[1].sql).toContain('"workspace_id" = $1');
    expect(calls()[1].sql).toContain('"form_id" is null');
    expect(calls()[1].sql).toContain('"soba"."credential_type_assignment"');
    expect(calls()[1].params).toEqual(['workspace', 20]);
  });

  it('requires workspace, form and credential identity for individual form reads and writes', async () => {
    await getWorkspaceCredential('workspace', 'credential', 'form');
    await updateCredentialNotes('workspace', 'credential', 'actor', 'Reference', 'form');
    for (const call of calls().filter(
      ({ sql }) => sql.startsWith('select') || sql.startsWith('update'),
    )) {
      expect(call.sql).toContain('"workspace_id" =');
      expect(call.sql).toContain('"form_id" =');
      expect(call.params).toEqual(expect.arrayContaining(['workspace', 'credential', 'form']));
    }
  });

  it('rolls back the credential reservation if assigning its types fails', async () => {
    // The node-postgres driver returns selected/returning columns in schema order.
    const row = [
      'credential',
      'workspace',
      'form',
      'issuer',
      null,
      null,
      'Key',
      '',
      'issuing',
      'actor',
      'actor',
      new Date().toISOString(),
      new Date().toISOString(),
      null,
    ];
    query
      .mockResolvedValueOnce(empty as never)
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 } as never)
      .mockRejectedValueOnce(new Error('type assignment failed'));
    await expect(
      reserveWorkspaceCredential(
        'workspace',
        'issuer',
        'actor',
        {
          label: 'Key',
          notes: '',
          types: ['api', 'web-component'],
        },
        'form',
      ),
    ).rejects.toThrow();
    const statements = calls();
    expect(statements[2].sql).toContain('insert into "soba"."credential_type_assignment"');
    expect(statements[2].params).toEqual(['credential', 'api', 'credential', 'web-component']);
    expect(statements.at(-1)?.sql).toBe('rollback');
    expect(statements.some(({ sql }) => sql === 'commit')).toBe(false);
    expect(
      statements.some(({ sql }) => sql.includes('insert into "soba"."credential_audit"')),
    ).toBe(false);
  });

  it('refuses empty types before inserting a reservation', async () => {
    await expect(
      reserveWorkspaceCredential('workspace', 'issuer', 'actor', {
        label: 'Key',
        notes: '',
        types: [],
      }),
    ).rejects.toThrow('at least one type');
    expect(calls().some(({ sql }) => sql.startsWith('insert'))).toBe(false);
  });
});
