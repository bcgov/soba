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
    ).toThrow(ConflictError);
  });

  it('holds a write against a submitted submission as pending (closed)', () => {
    expect(
      decideSubmissionWrite({
        submission: submitted,
        eventType: 'saved',
        baseRevisionId: 'rev-2',
        recorded: null,
      }),
    ).toEqual({ kind: 'pending', reason: 'closed', parentRevisionId: 'rev-2' });
  });

  it('holds a write whose base is no longer the head as pending (conflict)', () => {
    expect(
      decideSubmissionWrite({
        submission: draft,
        eventType: 'saved',
        baseRevisionId: 'rev-1',
        recorded: null,
      }),
    ).toEqual({ kind: 'pending', reason: 'conflict', parentRevisionId: 'rev-1' });
  });

  it('holds a submit whose base is no longer the head as pending too', () => {
    expect(
      decideSubmissionWrite({
        submission: draft,
        eventType: 'submitted',
        baseRevisionId: 'rev-1',
        recorded: null,
      }),
    ).toEqual({ kind: 'pending', reason: 'conflict', parentRevisionId: 'rev-1' });
  });

  it('writes as current on top of the base when it is the head', () => {
    expect(
      decideSubmissionWrite({
        submission: draft,
        eventType: 'submitted',
        baseRevisionId: 'rev-2',
        recorded: null,
      }),
    ).toEqual({ kind: 'current', workflowState: 'submitted', parentRevisionId: 'rev-2' });
  });

  it('writes as current on top of the current head when no base is sent', () => {
    expect(
      decideSubmissionWrite({ submission: draft, eventType: 'saved', recorded: null }),
    ).toEqual({ kind: 'current', workflowState: 'draft', parentRevisionId: 'rev-2' });
  });
});
