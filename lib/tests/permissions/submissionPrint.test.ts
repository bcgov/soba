import { Permissions, printChoiceOf, type PrintFacts } from '../../src/permissions';

const facts = (overrides: Partial<PrintFacts> = {}): PrintFacts => ({
  renderAvailable: true,
  hasTemplate: true,
  permissions: [],
  ...overrides,
});

const READ_ONLY = [Permissions.submission_read];
const UPLOAD_ONLY = [Permissions.submission_print_upload];
const REVIEWER = [...READ_ONLY, ...UPLOAD_ONLY];

describe('printChoiceOf', () => {
  it.each([
    ['a submitter with a stored template', facts(), 'template'],
    ['a submitter without one', facts({ hasTemplate: false }), 'browser'],
    ['staff with submission_read only', facts({ permissions: READ_ONLY }), 'template'],
    ['staff with the upload permission only', facts({ permissions: UPLOAD_ONLY }), 'template'],
    ['a reviewer', facts({ permissions: REVIEWER }), 'options'],
    ['a reviewer, no template', facts({ permissions: REVIEWER, hasTemplate: false }), 'options'],
    ['a form administrator', facts({ permissions: ['*'], hasTemplate: false }), 'options'],
  ])('gives %s %s', (_label, input, expected) => {
    expect(printChoiceOf(input)).toBe(expected);
  });

  it.each([
    ['a submitter', facts({ renderAvailable: false })],
    ['a reviewer', facts({ renderAvailable: false, permissions: REVIEWER })],
    ['a form administrator', facts({ renderAvailable: false, permissions: ['*'] })],
  ])('gives %s only the browser print without a render backend', (_label, input) => {
    expect(printChoiceOf(input)).toBe('browser');
  });
});
