import {
  decideRecordedWrite,
  decideSubmissionWrite,
  type RecordedRevision,
  type SubmissionWriteRequest,
} from '../../../src/core/services/submissionWriteGate';
import { ConflictError } from '../../../src/core/errors';

const draft = { id: 's1', workflowState: 'draft', headRevisionId: 'rev-2' };
const submitted = { ...draft, workflowState: 'submitted' };

const decide = (over: Partial<SubmissionWriteRequest> = {}) =>
  decideSubmissionWrite({
    submission: draft,
    eventType: 'saved',
    baseRevisionId: 'rev-2',
    ...over,
  });

const recordedSave: RecordedRevision = {
  submissionId: 's1',
  eventType: 'saved',
  changedBy: 'actor-1',
  revisionNo: 3,
  status: 'current',
  reason: 'accepted',
};

const decideRecorded = (recorded: RecordedRevision | null) =>
  decideRecordedWrite({
    submissionId: 's1',
    eventType: 'saved',
    actorId: 'actor-1',
    revisionId: 'rev-3',
    recorded,
  });

describe('decideRecordedWrite', () => {
  it('treats an unrecorded revision id as a new write', () => {
    expect(decideRecorded(null)).toEqual({ kind: 'new' });
  });

  it("replays the caller's own write where it landed", () => {
    expect(decideRecorded(recordedSave)).toEqual({
      kind: 'replay',
      revision: { id: 'rev-3', revisionNo: 3, status: 'current', reason: 'accepted' },
    });
  });

  it('replays a since-superseded revision as current', () => {
    expect(decideRecorded({ ...recordedSave, status: 'superseded' })).toMatchObject({
      kind: 'replay',
      revision: { status: 'current', reason: 'accepted' },
    });
  });

  it('replays a pending revision as pending with its reason', () => {
    expect(
      decideRecorded({ ...recordedSave, status: 'pending', reason: 'conflict' }),
    ).toMatchObject({ kind: 'replay', revision: { status: 'pending', reason: 'conflict' } });
  });

  it.each([
    ['on another submission', { submissionId: 's2' }],
    ['for another event type', { eventType: 'submitted' }],
    ['by another actor', { changedBy: 'actor-2' }],
    ['with no actor', { changedBy: null }],
  ])('refuses a revision id recorded %s', (_label, over) => {
    expect(() => decideRecorded({ ...recordedSave, ...over })).toThrow(ConflictError);
    expect(() => decideRecorded({ ...recordedSave, ...over })).toThrow(
      expect.objectContaining({ code: 'revision_id_taken' }),
    );
  });
});

describe('decideSubmissionWrite', () => {
  it('holds a write against a submitted submission as pending (closed)', () => {
    expect(decide({ submission: submitted, baseRevisionId: 'rev-2' })).toEqual({
      kind: 'pending',
      reason: 'closed',
      parentRevisionId: 'rev-2',
    });
  });

  it('holds a write whose base is no longer the head as pending (conflict)', () => {
    expect(decide({ baseRevisionId: 'rev-1' })).toEqual({
      kind: 'pending',
      reason: 'conflict',
      parentRevisionId: 'rev-1',
    });
  });

  it('holds a submit whose base is no longer the head as pending too', () => {
    expect(decide({ eventType: 'submitted', baseRevisionId: 'rev-1' })).toEqual({
      kind: 'pending',
      reason: 'conflict',
      parentRevisionId: 'rev-1',
    });
  });

  it('writes as current on top of the base when it is the head', () => {
    expect(decide({ eventType: 'submitted', baseRevisionId: 'rev-2' })).toEqual({
      kind: 'current',
      workflowState: 'submitted',
      parentRevisionId: 'rev-2',
    });
  });

  it('writes a save as current on top of the head', () => {
    expect(decide()).toEqual({
      kind: 'current',
      workflowState: 'draft',
      parentRevisionId: 'rev-2',
    });
  });
});
