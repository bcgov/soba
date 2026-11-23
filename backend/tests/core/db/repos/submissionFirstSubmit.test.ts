import { SubmissionEventType } from '../../../../src/core/db/codes';
import { isFirstSubmit } from '../../../../src/core/db/repos/submissionRevisionChain';

describe('isFirstSubmit', () => {
  it('is true for a submit to a submission never submitted', () => {
    expect(isFirstSubmit(SubmissionEventType.submitted, { submittedAt: null })).toBe(true);
  });

  it('is false for a resubmit', () => {
    expect(isFirstSubmit(SubmissionEventType.submitted, { submittedAt: new Date() })).toBe(false);
  });

  it('is false for a save', () => {
    expect(isFirstSubmit(SubmissionEventType.saved, { submittedAt: null })).toBe(false);
  });
});
