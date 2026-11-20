import { CredentialFieldsSchema, CredentialStateSchema } from '../../src/schemas/credentials';

const input = { label: 'Integration', notes: '', types: ['api'] };
describe('credential fields', () => {
  it('accepts either type or both and trims text', () => {
    for (const types of [['api'], ['web-component'], ['api', 'web-component']]) {
      expect(
        CredentialFieldsSchema.parse({ ...input, label: ' Integration ', notes: ' Vault ', types }),
      ).toEqual({ label: 'Integration', notes: 'Vault', types });
    }
  });
  it.each([
    { ...input, label: ' ' },
    { ...input, label: 'x'.repeat(101) },
    { ...input, notes: 'x'.repeat(1001) },
    { ...input, types: [] },
    { ...input, types: ['api', 'api'] },
    { ...input, types: ['unknown'] },
    { ...input, clientId: 'untrusted' },
  ])('rejects invalid input %j', (body) => {
    expect(CredentialFieldsSchema.safeParse(body).success).toBe(false);
  });
});

describe('credential state', () => {
  const state = {
    available: true,
    items: [],
    page: { offset: 0, limit: 10, total: 0 },
    filters: {},
    sort: 'createdAt:desc',
  };
  it('accepts a state with or without the integration API URL', () => {
    expect(CredentialStateSchema.parse(state)).not.toHaveProperty('integrationApi');
    const url = 'https://gateway.example.test/integrations/v2';
    expect(
      CredentialStateSchema.parse({ ...state, integrationApi: { url } }).integrationApi,
    ).toEqual({ url });
  });
});
