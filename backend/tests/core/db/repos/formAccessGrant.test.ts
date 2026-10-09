jest.mock('../../../../src/core/db/client', () => ({ db: {} }));

import { PgDialect } from 'drizzle-orm/pg-core';
import {
  formAccessGrantFor,
  grantsNothing,
  permittedFormsWhere,
} from '../../../../src/core/db/repos/formAccessRepo';
import { forms } from '../../../../src/core/db/schema';

const columns = { workspaceId: forms.workspaceId, formId: forms.id };
const render = (grant: Parameters<typeof permittedFormsWhere>[0]) =>
  new PgDialect().sqlToQuery(permittedFormsWhere(grant, columns));

describe('permittedFormsWhere', () => {
  it('binds each id list as a single array parameter', () => {
    const workspaceIds = Array.from({ length: 40000 }, (_, i) => `ws-${i}`);
    const { sql, params } = render({
      workspaceIds,
      overriddenFormIds: ['f1', 'f2'],
      includedFormIds: ['f2'],
    });

    expect(params).toEqual([workspaceIds, ['f1', 'f2'], ['f2']]);
    expect(sql).toBe(
      '(("soba"."form"."workspace_id" = any($1::uuid[]) and not "soba"."form"."id" = any($2::uuid[])) or "soba"."form"."id" = any($3::uuid[]))',
    );
  });

  it('keeps no row for an empty grant', () => {
    const { sql, params } = render({
      workspaceIds: [],
      overriddenFormIds: [],
      includedFormIds: [],
    });

    expect(params).toEqual([]);
    expect(sql).toBe('((false and not false) or false)');
  });

  it('keeps only the form a single-form grant names', () => {
    const { sql, params } = render(formAccessGrantFor('f1'));

    expect(params).toEqual([['f1']]);
    expect(sql).toBe('((false and not false) or "soba"."form"."id" = any($1::uuid[]))');
  });
});

describe('grantsNothing', () => {
  it('is true only when no workspace and no form is granted', () => {
    expect(
      grantsNothing({ workspaceIds: [], overriddenFormIds: ['f1'], includedFormIds: [] }),
    ).toBe(true);
    expect(
      grantsNothing({ workspaceIds: ['ws1'], overriddenFormIds: [], includedFormIds: [] }),
    ).toBe(false);
    expect(grantsNothing(formAccessGrantFor('f1'))).toBe(false);
  });
});
