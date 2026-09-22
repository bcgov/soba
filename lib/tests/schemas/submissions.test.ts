import {
  OpenSubmissionBodySchema,
  SubmissionDataBodySchema,
  SubmitSubmissionBodySchema,
} from '../../src/schemas/submissions';

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

const revisionId = '01a0c65a-3d6d-7430-9d4e-7548062a8e04';
const baseRevisionId = '01a0c65a-39de-738f-87e6-84774616e6c5';

describe('SubmissionDataBodySchema', () => {
  it('requires both revision ids', () => {
    expect(SubmissionDataBodySchema.safeParse({ data: {} }).success).toBe(false);
    expect(SubmissionDataBodySchema.safeParse({ data: {}, revisionId }).success).toBe(false);
    expect(
      SubmissionDataBodySchema.safeParse({ data: {}, revisionId, baseRevisionId }).success,
    ).toBe(true);
  });

  it('rejects a revision id that is not v7', () => {
    const v4 = '3b241101-e2bb-4255-8caf-4136c566a962';
    expect(
      SubmissionDataBodySchema.safeParse({ data: {}, revisionId: v4, baseRevisionId }).success,
    ).toBe(false);
  });
});

describe('SubmitSubmissionBodySchema', () => {
  it.each([
    ['no revision ids', { data: {} }, true],
    ['both revision ids', { data: {}, revisionId, baseRevisionId }, true],
    ['only revisionId', { data: {}, revisionId }, false],
    ['only baseRevisionId', { data: {}, baseRevisionId }, false],
  ])('%s', (_label, body, ok) => {
    expect(SubmitSubmissionBodySchema.safeParse(body).success).toBe(ok);
  });
});
