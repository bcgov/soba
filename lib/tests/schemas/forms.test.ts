import {
  CreateFormBodySchema,
  MyFormListItemSchema,
  SubmitterFormFactsSchema,
  SubmitterFormSchema,
} from '../../src/schemas/forms';
import { canStartSubmission, type SubmitterFormFacts } from '../../src/permissions';

const base = { workspaceId: 'ws1', name: 'My Form' };

const facts = {
  publishedVersionId: 'v1',
  permissions: ['submission_create'],
  audienceMode: 'members',
  audienceIdps: [],
  allowSubmitterDrafts: true,
};

describe('submitter form schemas', () => {
  it('reads the facts the submitter rules take', () => {
    const parsed: SubmitterFormFacts = SubmitterFormFactsSchema.parse(facts);
    expect(canStartSubmission(parsed, { idpCode: 'idir' })).toBe(true);
  });

  it.each([
    ['an unknown audience', { audienceMode: 'everyone' }],
    ['a missing drafts setting', { allowSubmitterDrafts: undefined }],
  ])('rejects facts with %s', (_label, overrides) => {
    expect(SubmitterFormFactsSchema.safeParse({ ...facts, ...overrides }).success).toBe(false);
  });

  it('carries what the form is alongside its facts', () => {
    const row = { id: 'f1', name: 'Permit', workspaceId: 'ws1', workspaceName: 'Roads', ...facts };
    expect(SubmitterFormSchema.parse(row)).toEqual(row);
  });

  it('lists My Forms rows as submitter forms', () => {
    expect(MyFormListItemSchema).toBe(SubmitterFormSchema);
  });
});

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
