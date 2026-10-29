import { JobType } from '../../../src/core/db/codes';
import type { AdminJobListRow } from '../../../src/core/db/repos/jobAdminRepo';
import { LEASE_EXPIRED } from '../../../src/core/db/repos/jobRepo';
import type { JobNotificationSend } from '../../../src/core/db/repos/notificationAuditRepo';
import {
  countEmails,
  redactAddresses,
  rerunRefusal,
  toJobListItem,
  type RerunFacts,
} from '../../../src/core/services/jobAdminService';

const now = new Date('2026-10-28T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const MINUTE = 60_000;
const DAY = 86_400_000;

const facts = (overrides: Partial<RerunFacts> = {}): RerunFacts => ({
  status: 'dead',
  type: 'post-submission-email-addresses',
  registered: true,
  childCount: 0,
  childrenQueuedAt: null,
  finishedAt: ago(10 * MINUTE),
  lastError: 'Email send failed (status 503) after 1 of 3',
  now,
  leaseMs: MINUTE,
  ...overrides,
});

describe('rerunRefusal', () => {
  it.each(['dead', 'cancelled'])('lets a %s job run again', (status) => {
    expect(rerunRefusal(facts({ status }))).toBeNull();
  });

  it.each(['queued', 'running', 'succeeded'])('refuses a %s job', (status) => {
    expect(rerunRefusal(facts({ status }))).toBe('Only a dead or cancelled job can be run again');
  });

  it('refuses a type this environment does not run', () => {
    expect(rerunRefusal(facts({ registered: false }))).toBe(
      'This environment does not run jobs of this type',
    );
  });

  const received = (overrides: Partial<RerunFacts>) =>
    rerunRefusal(facts({ type: JobType.submission_submitted, ...overrides }));
  const queuedAlready = 'Its actions were queued already; run their jobs again instead';

  it('runs a submission-received job again when it queued no actions', () => {
    expect(received({})).toBeNull();
  });

  it('refuses a submission-received job that queued actions, which would send their emails again', () => {
    expect(received({ childCount: 1 })).toBe(queuedAlready);
  });

  it('refuses a submission-received job whose queued actions were deleted under retention', () => {
    expect(received({ childrenQueuedAt: ago(40 * DAY) })).toBe(queuedAlready);
  });

  // Its fan-out rolled back, so no dedupe key was taken and nothing was sent.
  it('runs a submission-received job again however old, when it never queued its actions', () => {
    expect(received({ finishedAt: ago(60 * DAY) })).toBeNull();
  });

  it('refuses a job whose lease expired within the last lease, as it may still be running', () => {
    expect(rerunRefusal(facts({ lastError: LEASE_EXPIRED, finishedAt: ago(MINUTE / 2) }))).toBe(
      'Its last run may still be finishing; try again in a minute',
    );
    expect(rerunRefusal(facts({ lastError: LEASE_EXPIRED, finishedAt: ago(2 * MINUTE) }))).toBe(
      null,
    );
    expect(rerunRefusal(facts({ finishedAt: ago(MINUTE / 2) }))).toBeNull();
  });
});

describe('countEmails', () => {
  const send = (
    to: string,
    outcome: JobNotificationSend['outcome'],
    httpStatus: number | null = null,
  ): JobNotificationSend => ({ outcome, httpStatus, recipients: { to: [to] }, createdAt: now });

  it('counts each address once, by where it stands', () => {
    const counts = countEmails(
      ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com', 'e@example.com'],
      [
        send('a@example.com', 'accepted'),
        send('b@example.com', 'error', 400),
        send('c@example.com', 'error', 503),
        send('d@example.com', 'not_sent'),
        send('a@example.com', 'accepted'),
      ],
    );
    expect(counts).toEqual({ addresses: 5, sent: 2, refused: 1, pending: 2 });
  });

  it('counts an address refused and then accepted as sent', () => {
    expect(
      countEmails(
        ['a@example.com'],
        [send('a@example.com', 'error', 422), send('a@example.com', 'accepted')],
      ),
    ).toEqual({ addresses: 1, sent: 1, refused: 0, pending: 0 });
  });

  it('ignores sends to addresses no longer on the list', () => {
    expect(countEmails(['a@example.com'], [send('z@example.com', 'accepted')])).toEqual({
      addresses: 1,
      sent: 0,
      refused: 0,
      pending: 1,
    });
  });
});

describe('redactAddresses', () => {
  it('replaces each word holding an @, whatever wraps it', () => {
    expect(redactAddresses('Bad address: <a.b+c@example.com>, also x@y')).toBe(
      'Bad address: [address] also [address]',
    );
  });

  it('keeps text without one, and null', () => {
    expect(redactAddresses('Database error 23505 on job_dedupe_key_unique')).toBe(
      'Database error 23505 on job_dedupe_key_unique',
    );
    expect(redactAddresses(null)).toBeNull();
  });
});

describe('toJobListItem', () => {
  it('returns error text without addresses', () => {
    const row: AdminJobListRow = {
      id: '00000000-0000-4000-8000-000000000001',
      type: 'post-submission-email-addresses',
      status: 'dead',
      attempts: 3,
      maxAttempts: 3,
      workspaceId: '00000000-0000-4000-8000-000000000002',
      workspaceName: 'Licensing',
      formId: null,
      formName: null,
      submissionId: null,
      createdAt: now,
      runAfter: now,
      finishedAt: now,
      cancelRequestedAt: null,
      requeueCount: 0,
      lastError: 'insert failed for a@example.com',
    };
    expect(toJobListItem(row)).toMatchObject({
      lastError: 'insert failed for [address]',
      finishedAt: now.toISOString(),
      cancelRequestedAt: null,
    });
  });
});
