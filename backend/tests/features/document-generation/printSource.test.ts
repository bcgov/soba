import {
  printContextOf,
  printSourceOf,
} from '../../../src/features/document-generation/printSource';

const saved = { data: { name: 'Ann', tags: [1, 2] } };

describe('printSourceOf', () => {
  it('prints the saved answers as a draft when none are sent', () => {
    expect(printSourceOf({ saved, workflowState: 'draft' })).toEqual({
      data: saved,
      status: 'draft',
    });
  });

  it('prints the saved answers of a submitted submission as submitted', () => {
    expect(printSourceOf({ saved, workflowState: 'submitted' })?.status).toBe('submitted');
  });

  it('prints a submission sent back to revise as a draft', () => {
    expect(printSourceOf({ saved, workflowState: 'revising' })?.status).toBe('draft');
  });

  it.each([
    ['answers that differ from the saved ones', { name: 'Bob' }],
    ['answers equal to the saved ones', { ...saved.data }],
  ])('prints %s as unsaved, whatever the state', (_label, sent) => {
    expect(printSourceOf({ saved, sent, workflowState: 'submitted' })).toEqual({
      data: { data: sent },
      status: 'unsaved',
    });
  });

  it('prints the answers sent as unsaved when nothing is saved', () => {
    const sent = { name: 'Ann' };
    expect(printSourceOf({ saved: null, sent, workflowState: 'opened' })).toEqual({
      data: { data: sent },
      status: 'unsaved',
    });
  });

  it('keeps an answer keyed "data" inside the answers sent', () => {
    const sent = { data: 'a field named data' };
    expect(printSourceOf({ saved: null, sent, workflowState: 'opened' })?.data).toEqual({
      data: sent,
    });
  });

  it('has nothing to print when nothing is saved or sent', () => {
    expect(printSourceOf({ saved: null, workflowState: 'opened' })).toBeNull();
  });
});

describe('printContextOf', () => {
  const submission = (workflowState: string) => ({
    confirmationCode: 'ABC123',
    currentRevisionNo: 4,
    workflowState,
  });
  const now = new Date('2026-11-12T18:00:00.000Z');

  it('gives a submitted print its confirmation code and revision', () => {
    expect(printContextOf(submission('submitted'), 'submitted', now)).toEqual({
      status: 'submitted',
      printedAt: '2026-11-12T18:00:00.000Z',
      confirmationCode: 'ABC123',
      revisionNo: 4,
    });
  });

  it('gives a draft its revision but no confirmation code', () => {
    expect(printContextOf(submission('draft'), 'draft', now)).toMatchObject({
      confirmationCode: null,
      revisionNo: 4,
    });
  });

  it('keeps the confirmation code of a submission sent back to revise', () => {
    expect(printContextOf(submission('revising'), 'draft', now)).toMatchObject({
      status: 'draft',
      confirmationCode: 'ABC123',
      revisionNo: 4,
    });
  });

  it('gives unsaved answers neither, whatever the state', () => {
    expect(printContextOf(submission('revising'), 'unsaved', now)).toMatchObject({
      confirmationCode: null,
      revisionNo: null,
    });
  });
});
