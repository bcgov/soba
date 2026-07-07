import { assertCreateTargetConsistent } from '../../../src/core/middleware/formSubmitAccess';
import { ValidationError } from '../../../src/core/errors';

const published = { state: 'published', formId: 'form1' };

describe('assertCreateTargetConsistent', () => {
  it('passes when the body targets the published version with a matching formId', () => {
    expect(() =>
      assertCreateTargetConsistent(published, { formVersionId: 'v1', formId: 'form1' }),
    ).not.toThrow();
  });

  it('rejects a create against a non-published version', () => {
    for (const state of ['draft', 'archived', 'deleted']) {
      expect(() =>
        assertCreateTargetConsistent(
          { state, formId: 'form1' },
          {
            formVersionId: 'v1',
            formId: 'form1',
          },
        ),
      ).toThrow(ValidationError);
    }
  });

  it('rejects a formId that does not match the target version', () => {
    expect(() =>
      assertCreateTargetConsistent(published, { formVersionId: 'v1', formId: 'other' }),
    ).toThrow(ValidationError);
  });

  it('is a no-op for the save path (no formVersionId in the body)', () => {
    expect(() => assertCreateTargetConsistent(published, { formId: 'anything' })).not.toThrow();
    expect(() => assertCreateTargetConsistent(published, undefined)).not.toThrow();
  });
});
