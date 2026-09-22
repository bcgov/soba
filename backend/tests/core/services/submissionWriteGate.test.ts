import { decideSubmissionWrite } from '../../../src/core/services/submissionWriteGate';
import { ConflictError } from '../../../src/core/errors';

const draft = { id: 's1', workflowState: 'draft', headRevisionId: 'rev-2' };
const submitted = { ...draft, workflowState: 'submitted' };

describe('decideSubmissionWrite', () => {
  it('replays a submit already recorded on a submitted submission', () => {
    expect(
      decideSubmissionWrite({
        submission: submitted,
        eventType: 'submitted',
        baseRevisionId: 'rev-1',
        recorded: { submissionId: 's1', eventType: 'submitted' },
      }),
    ).toEqual({ kind: 'replay' });
  });

  it('refuses a new submit on a submitted submission', () => {
    expect(() =>
      decideSubmissionWrite({
        submission: submitted,
        eventType: 'submitted',
        baseRevisionId: 'rev-2',
        recorded: null,
      }),
    ).toThrow('Submission is submitted and can no longer be changed');
  });

  it.each([
    ['another submission', { submissionId: 's2', eventType: 'saved' }],
    ['another event type', { submissionId: 's1', eventType: 'submitted' }],
  ])('refuses a revision id recorded by %s', (_label, recorded) => {
    expect(() =>
      decideSubmissionWrite({
        submission: draft,
        eventType: 'saved',
        baseRevisionId: 'rev-2',
        recorded,
      }),
    ).toThrow('Revision id already used by another write');
  });

  it('refuses a base that is no longer the head', () => {
    expect(() =>
      decideSubmissionWrite({
        submission: draft,
        eventType: 'saved',
        baseRevisionId: 'rev-1',
        recorded: null,
      }),
    ).toThrow(ConflictError);
  });

  it('writes on top of the base when it is the head', () => {
    expect(
      decideSubmissionWrite({
        submission: draft,
        eventType: 'submitted',
        baseRevisionId: 'rev-2',
        recorded: null,
      }),
    ).toEqual({ kind: 'write', workflowState: 'submitted', parentRevisionId: 'rev-2' });
  });

  it('writes on top of the current head when no base is sent', () => {
    expect(
      decideSubmissionWrite({ submission: draft, eventType: 'saved', recorded: null }),
    ).toEqual({ kind: 'write', workflowState: 'draft', parentRevisionId: 'rev-2' });
  });
});
