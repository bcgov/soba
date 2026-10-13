import {
  FormSubmitterAudienceSchema,
  SetFormSubmitterAudienceBodySchema,
} from '../../src/schemas/groups';

describe('SetFormSubmitterAudienceBodySchema', () => {
  it.each([
    ['inherit', { mode: 'inherit' }],
    ['public', { mode: 'public' }],
    ['protected with a provider', { mode: 'protected', idps: ['azureidir'] }],
  ])('accepts %s', (_label, body) => {
    expect(SetFormSubmitterAudienceBodySchema.safeParse(body).success).toBe(true);
  });

  // A form override replaces the workspace members, so protected with no provider admits nobody.
  it.each([
    ['protected with no providers', { mode: 'protected', idps: [] }],
    ['protected without idps', { mode: 'protected' }],
    ['a blank provider', { mode: 'protected', idps: [' '] }],
    ['an unknown mode', { mode: 'none' }],
  ])('rejects %s', (_label, body) => {
    expect(SetFormSubmitterAudienceBodySchema.safeParse(body).success).toBe(false);
  });

  it('accepts up to 20 providers and trims them', () => {
    const idps = Array.from({ length: 20 }, (_, i) => ` idp${i} `);
    expect(SetFormSubmitterAudienceBodySchema.parse({ mode: 'protected', idps })).toEqual({
      mode: 'protected',
      idps: idps.map((code) => code.trim()),
    });
  });

  it('rejects more than 20 providers', () => {
    const idps = Array.from({ length: 21 }, (_, i) => `idp${i}`);
    expect(SetFormSubmitterAudienceBodySchema.safeParse({ mode: 'protected', idps }).success).toBe(
      false,
    );
  });
});

describe('FormSubmitterAudienceSchema', () => {
  const inherited = {
    inherit: true,
    mode: 'protected',
    idps: ['azureidir'],
    available: [{ code: 'azureidir', name: 'IDIR - MFA' }],
    workspace: {
      mode: 'protected',
      idps: ['azureidir'],
      users: [{ membershipId: 'm1', displayLabel: null }],
    },
  };

  it('parses an inherited form audience', () => {
    expect(FormSubmitterAudienceSchema.parse(inherited)).toEqual(inherited);
  });

  // The form page shows the workspace audience beside its own, so a response without it is invalid.
  it('rejects an audience without the workspace summary', () => {
    const withoutWorkspace = { ...inherited, workspace: undefined };
    expect(FormSubmitterAudienceSchema.safeParse(withoutWorkspace).success).toBe(false);
  });
});
