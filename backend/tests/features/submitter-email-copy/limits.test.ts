import {
  exceededEmailCopyLimit,
  readEmailCopyLimits,
} from '../../../src/features/submitter-email-copy/limits';

describe('readEmailCopyLimits', () => {
  it('uses the defaults when nothing is set, or a value is blank', () => {
    const defaults = {
      submission: 5,
      recipient: 10,
      form: 500,
      workspace: 2000,
      environment: 5000,
    };
    expect(readEmailCopyLimits({})).toEqual(defaults);
    expect(readEmailCopyLimits({ SUBMITTER_EMAIL_COPY_FORM_HOURLY_LIMIT: '  ' })).toEqual(defaults);
  });

  it('reads each limit from its variable', () => {
    expect(
      readEmailCopyLimits({
        SUBMITTER_EMAIL_COPY_SUBMISSION_HOURLY_LIMIT: '1',
        SUBMITTER_EMAIL_COPY_RECIPIENT_HOURLY_LIMIT: '2',
        SUBMITTER_EMAIL_COPY_FORM_HOURLY_LIMIT: '3',
        SUBMITTER_EMAIL_COPY_WORKSPACE_HOURLY_LIMIT: '4',
        SUBMITTER_EMAIL_COPY_ENVIRONMENT_HOURLY_LIMIT: '1000000',
      }),
    ).toEqual({ submission: 1, recipient: 2, form: 3, workspace: 4, environment: 1_000_000 });
  });

  // Out of range stops the start, naming the variable, rather than leaving no limit at all.
  it.each(['0', '-1', '2.5', 'many', '1000001'])('refuses %s', (raw) => {
    expect(() => readEmailCopyLimits({ SUBMITTER_EMAIL_COPY_RECIPIENT_HOURLY_LIMIT: raw })).toThrow(
      `SUBMITTER_EMAIL_COPY_RECIPIENT_HOURLY_LIMIT must be a whole number from 1 to 1000000, got '${raw}'`,
    );
  });
});

describe('exceededEmailCopyLimit', () => {
  const limits = { submission: 5, recipient: 10, form: 500, workspace: 2000, environment: 5000 };
  const none = { submission: 0, recipient: 0, form: 0, workspace: 0, environment: 0 };

  it('allows a copy while every count is under its limit', () => {
    expect(
      exceededEmailCopyLimit(
        { submission: 4, recipient: 9, form: 499, workspace: 1999, environment: 4999 },
        limits,
      ),
    ).toBeNull();
  });

  // A count at its limit means the next copy would pass it.
  it.each(['submission', 'recipient', 'form', 'workspace', 'environment'] as const)(
    'names the %s limit once its count reaches it',
    (scope) => {
      expect(exceededEmailCopyLimit({ ...none, [scope]: limits[scope] }, limits)).toBe(scope);
    },
  );

  it('names the narrowest limit when several are reached', () => {
    expect(exceededEmailCopyLimit({ ...limits }, limits)).toBe('submission');
  });
});
