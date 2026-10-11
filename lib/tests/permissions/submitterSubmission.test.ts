import {
  canDeleteOwnSubmission,
  isSubmissionInProgress,
  SubmissionParticipantRole,
  SubmissionWorkflowState,
} from '../../src/permissions';

const STATES = Object.values(SubmissionWorkflowState);
const ROLES = Object.values(SubmissionParticipantRole);

describe('isSubmissionInProgress', () => {
  it.each(STATES)('answers %s', (state) => {
    const expected = state === 'opened' || state === 'draft';
    expect(isSubmissionInProgress(state)).toBe(expected);
  });

  it('treats an unknown state as not in progress', () => {
    expect(isSubmissionInProgress('archived')).toBe(false);
  });
});

describe('canDeleteOwnSubmission', () => {
  const cases = STATES.flatMap((workflowState) =>
    ROLES.map((role) => ({
      workflowState,
      role,
      expected: role === 'owner' && (workflowState === 'opened' || workflowState === 'draft'),
    })),
  );

  it.each(cases)('$role on a $workflowState submission: $expected', (facts) => {
    expect(canDeleteOwnSubmission(facts)).toBe(facts.expected);
  });
});
