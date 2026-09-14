import { OpenSubmissionBodySchema } from '../../src/schemas/submissions';

// The client mints the submission id and it is the record's identity, so only a v7 uuid is accepted.
describe('OpenSubmissionBodySchema', () => {
  it.each([
    ['nil', '00000000-0000-0000-0000-000000000000'],
    ['max', 'ffffffff-ffff-ffff-ffff-ffffffffffff'],
    ['v4', '3b241101-e2bb-4255-8caf-4136c566a962'],
    ['non-uuid', 'not-a-uuid'],
  ])('rejects a %s id', (_label, id) => {
    expect(OpenSubmissionBodySchema.safeParse({ id, formId: 'f1' }).success).toBe(false);
  });

  it('accepts a v7 id', () => {
    const id = '01a08da2-5717-7348-a6a7-ee556b9980b3';
    expect(OpenSubmissionBodySchema.safeParse({ id, formId: 'f1' }).success).toBe(true);
  });
});
