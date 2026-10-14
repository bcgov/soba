import { SUBMISSION_IN_PROGRESS_STATES } from '@soba/lib';
import { isTerminalSubmissionState } from '../../../src/core/services/submissionLifecycle';

describe('SUBMISSION_IN_PROGRESS_STATES', () => {
  it('holds no terminal state', () => {
    expect(SUBMISSION_IN_PROGRESS_STATES.filter(isTerminalSubmissionState)).toEqual([]);
  });
});
