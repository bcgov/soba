jest.mock('../../../src/core/db/client', () => {
  const { drizzle } = jest.requireActual('drizzle-orm/node-postgres');
  const client = { query: jest.fn(async () => ({ rows: [], rowCount: 1 })) };
  return { db: drizzle(client) };
});
jest.mock('../../../src/features/dev-data/runs', () => ({
  listOpenRuns: jest.fn(async () => []),
  idsFromRuns: jest.fn(() => ({
    workspaceIds: ['01900000-0000-7000-8000-000000000001'],
    userIds: [],
  })),
  markRunsPurged: jest.fn(async () => undefined),
}));
import { db } from '../../../src/core/db/client';
import { purge } from '../../../src/features/dev-data/purge';

// Compile real Drizzle queries against a fake client so deletion scope and FK order are checked.
describe('dev-data credential purge', () => {
  it('deletes only targeted workspaces audit rows before credentials and workspaces', async () => {
    const query = jest.mocked(db.$client.query);
    query.mockClear();
    const result = await purge();
    const calls = query.mock.calls.map((args) => {
      const config = args[0] as unknown as string | { text: string };
      return { sql: typeof config === 'string' ? config : config.text, params: args[1] };
    });
    const auditIndex = calls.findIndex(({ sql }) =>
      sql.startsWith('delete from "soba"."credential_audit"'),
    );
    const credentialIndex = calls.findIndex(({ sql }) =>
      sql.startsWith('delete from "soba"."workspace_credential"'),
    );
    const workspaceIndex = calls.findIndex(({ sql }) =>
      sql.startsWith('delete from "soba"."workspace"'),
    );
    expect(auditIndex).toBeGreaterThan(-1);
    expect(credentialIndex).toBeGreaterThan(auditIndex);
    expect(workspaceIndex).toBeGreaterThan(credentialIndex);
    expect(calls[auditIndex].sql).toContain('select "id" from "soba"."workspace_credential"');
    expect(calls[auditIndex].sql).toContain('"workspace_id" in ($1)');
    expect(calls[auditIndex].params).toEqual(['01900000-0000-7000-8000-000000000001']);
    expect(calls[credentialIndex].params).toEqual(['01900000-0000-7000-8000-000000000001']);
    expect(result.rowsDeleted.credential_audit).toBe(1);
    expect(result.rowsDeleted.workspace_credential).toBe(1);
  });
});
