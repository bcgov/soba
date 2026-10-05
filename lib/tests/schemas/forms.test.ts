import { CreateFormBodySchema } from '../../src/schemas/forms';

const base = { workspaceId: 'ws1', name: 'My Form' };

describe('CreateFormBodySchema settings', () => {
  it('accepts a form that inherits every group', () => {
    expect(CreateFormBodySchema.safeParse(base).success).toBe(true);
    expect(CreateFormBodySchema.safeParse({ ...base, settings: {} }).success).toBe(true);
  });

  it('accepts an audience for the new form', () => {
    const settings = { audience: { inherit: false, values: { mode: 'members', idps: [] } } };
    expect(CreateFormBodySchema.parse({ ...base, settings }).settings).toEqual(settings);
  });

  // A group the create does not apply would be dropped without a word, so it is refused.
  it.each([
    ['an unknown group', { submitter: { inherit: true } }],
    [
      'protected with no provider',
      { audience: { inherit: false, values: { mode: 'protected', idps: [] } } },
    ],
  ])('rejects %s', (_label, settings) => {
    expect(CreateFormBodySchema.safeParse({ ...base, settings }).success).toBe(false);
  });

  it('rejects a key outside settings that it does not know', () => {
    const submitterAudience = { mode: 'protected', idps: ['bceidbasic'] };
    expect(CreateFormBodySchema.safeParse({ ...base, submitterAudience }).success).toBe(false);
  });
});
