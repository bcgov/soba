import {
  SUBMITTER_DELETABLE_STATES,
  isTerminalSubmissionState,
} from '../../../src/core/services/submissionLifecycle';

describe('SUBMITTER_DELETABLE_STATES', () => {
  it('is exactly the states before a submission is submitted', () => {
    expect([...SUBMITTER_DELETABLE_STATES].sort()).toEqual(['draft', 'opened']);
  });

  it('holds no terminal state', () => {
    expect(SUBMITTER_DELETABLE_STATES.filter(isTerminalSubmissionState)).toEqual([]);
  });
});
