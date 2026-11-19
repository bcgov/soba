import type { Logger } from 'pino';
import type { SendEmail } from '../../../../src/core/integrations/notification/NotificationAdapter';
import type {
  JobEmailResult,
  JobNotifications,
} from '../../../../src/core/integrations/notification/JobNotifications';
import { sendEachAddress } from '../../../../src/core/integrations/notification/sendEachAddress';
import {
  DAILY_LIMIT_REACHED,
  PROVIDER_LIMIT_REACHED,
} from '../../../../src/core/integrations/notification/dailyReset';
import { JobCancelledError, JobDeferredError } from '../../../../src/core/jobs/settlement';

const ACCEPTED: JobEmailResult = { outcome: 'accepted', httpStatus: null, audited: true };
const REFUSED: JobEmailResult = { outcome: 'error', httpStatus: 400, audited: true };
// The next daily reset, an hour away.
const RESET = new Date(Date.now() + 3_600_000);
const CONTENT: SendEmail['content'] = { subject: 'Subject', body: '<p>Body</p>', bodyType: 'html' };

/**
 * The job's notifications, kept in memory: what the provider answers per address, the addresses
 * this job sent to or had refused on earlier attempts, and the emails the environment may still
 * send today (plenty, by default).
 */
function fakeNotifications(
  setup: {
    enabled?: boolean;
    handled?: string[];
    refusedBefore?: string[];
    room?: number;
    answers?: Record<string, JobEmailResult>;
  } = {},
) {
  const emails: SendEmail[] = [];
  const sentBefore = setup.handled ?? [];
  const handled = [...sentBefore, ...(setup.refusedBefore ?? [])];
  const notifications: JobNotifications = {
    enabled: jest.fn(() => Promise.resolve(setup.enabled ?? true)),
    sendEmail: (email) => {
      emails.push(email);
      return Promise.resolve(setup.answers?.[email.recipients.to[0]] ?? ACCEPTED);
    },
    handled: () =>
      Promise.resolve({ recipients: new Set(handled), anySent: sentBefore.length > 0 }),
    dailyRoom: jest.fn(() => Promise.resolve({ room: setup.room ?? 3225, resetsAt: RESET })),
  };
  const recipients = () => emails.map((email) => email.recipients.to[0]);
  return { notifications, emails, recipients };
}

const run = (
  to: string[],
  notifications: JobNotifications,
  options: { signal?: AbortSignal; info?: jest.Mock; warn?: jest.Mock } = {},
) =>
  sendEachAddress(
    {
      notifications,
      signal: options.signal ?? new AbortController().signal,
      log: {
        info: options.info ?? jest.fn(),
        warn: options.warn ?? jest.fn(),
      } as unknown as Logger,
    },
    to,
    CONTENT,
  );

describe('sendEachAddress', () => {
  it('sends the content to each address in turn and logs only counts', async () => {
    const fake = fakeNotifications();
    const info = jest.fn();
    await run(['a@example.com', 'b@example.com'], fake.notifications, { info });

    expect(fake.recipients()).toEqual(['a@example.com', 'b@example.com']);
    expect(fake.emails[0].content).toEqual(CONTENT);
    expect(info).toHaveBeenCalledWith({ sent: 2, refused: 0, alreadyHandled: 0 }, 'Emails sent');
    expect(JSON.stringify(info.mock.calls)).not.toContain('@');
  });

  it('sends to each address once, in lower case', async () => {
    const fake = fakeNotifications();
    await run([' A@Example.com', 'a@example.com', 'B@example.com '], fake.notifications);
    expect(fake.recipients()).toEqual(['a@example.com', 'b@example.com']);
  });

  it('skips an address handled before whatever its case', async () => {
    const fake = fakeNotifications({ handled: ['A@Example.com'] });
    await run(['a@example.com', 'b@example.com'], fake.notifications);
    expect(fake.recipients()).toEqual(['b@example.com']);
  });

  it('counts an address no provider would take as refused, without sending to it', async () => {
    const fake = fakeNotifications();
    const warn = jest.fn();
    await run(['not an address', 'a@example.com'], fake.notifications, { warn });

    expect(fake.recipients()).toEqual(['a@example.com']);
    expect(warn).toHaveBeenCalledWith(
      { sent: 1, refused: 1, alreadyHandled: 0 },
      'Emails sent; some addresses were refused',
    );
  });

  it('ends cancelled, sending nothing, when no address is usable', async () => {
    const fake = fakeNotifications();
    await expect(run(['not an address'], fake.notifications)).rejects.toThrow(
      new JobCancelledError('Every address was refused (1)'),
    );
    expect(fake.emails).toEqual([]);
  });

  it('waits for the daily reset, sending nothing, when the day has no room left', async () => {
    const fake = fakeNotifications({ room: 0 });
    const sent = run(['a@example.com', 'b@example.com'], fake.notifications);
    await expect(sent).rejects.toBeInstanceOf(JobDeferredError);
    await expect(sent).rejects.toThrow(DAILY_LIMIT_REACHED);
    expect(fake.emails).toEqual([]);
  });

  it("sends what fits in the day's room, in order, and the rest wait for the reset", async () => {
    const fake = fakeNotifications({ room: 2 });
    const info = jest.fn();
    const sent = run(['a@example.com', 'b@example.com', 'c@example.com'], fake.notifications, {
      info,
    });
    await expect(sent).rejects.toBeInstanceOf(JobDeferredError);
    await expect(sent).rejects.toThrow(DAILY_LIMIT_REACHED);
    expect(fake.recipients()).toEqual(['a@example.com', 'b@example.com']);
    expect(info).toHaveBeenCalledWith(
      { sent: 2, refused: 0, alreadyHandled: 0, waiting: 1 },
      'Emails sent; the rest wait for the daily reset',
    );
  });

  it('waits rather than cancels when what fit today was refused and more are left', async () => {
    const fake = fakeNotifications({ room: 1, answers: { 'a@example.com': REFUSED } });
    await expect(run(['a@example.com', 'b@example.com'], fake.notifications)).rejects.toThrow(
      DAILY_LIMIT_REACHED,
    );
  });

  it('counts the room against what is left, not what was handled before', async () => {
    const fake = fakeNotifications({ room: 1, handled: ['a@example.com'] });
    await run(['a@example.com', 'b@example.com'], fake.notifications);
    expect(fake.recipients()).toEqual(['b@example.com']);
  });

  it("does not count today's sends when nothing is left to send", async () => {
    const fake = fakeNotifications({ handled: ['a@example.com'], room: 0 });
    await run(['a@example.com'], fake.notifications);
    expect(fake.notifications.dailyRoom).not.toHaveBeenCalled();
  });

  it('does nothing when every address was handled, even with notifications off', async () => {
    const fake = fakeNotifications({ handled: ['a@example.com'], enabled: false });
    await run(['a@example.com'], fake.notifications);
    expect(fake.emails).toEqual([]);
    expect(fake.notifications.enabled).not.toHaveBeenCalled();
  });

  it('ends cancelled, sending nothing, when notifications are off', async () => {
    const fake = fakeNotifications({ enabled: false });
    await expect(run(['a@example.com'], fake.notifications)).rejects.toThrow(
      new JobCancelledError('Notifications are off'),
    );
    expect(fake.emails).toEqual([]);
  });

  it.each([400, 422])(
    'records an address refused with %i, carries on, and warns with counts',
    async (httpStatus) => {
      const fake = fakeNotifications({
        answers: { 'a@example.com': { outcome: 'error', httpStatus, audited: true } },
      });
      const warn = jest.fn();
      await run(['a@example.com', 'b@example.com'], fake.notifications, { warn });

      expect(fake.recipients()).toEqual(['a@example.com', 'b@example.com']);
      expect(warn).toHaveBeenCalledWith(
        { sent: 1, refused: 1, alreadyHandled: 0 },
        'Emails sent; some addresses were refused',
      );
    },
  );

  it('ends cancelled when a fresh list is refused at every address', async () => {
    const fake = fakeNotifications({
      answers: { 'a@example.com': REFUSED, 'b@example.com': REFUSED },
    });
    const warn = jest.fn();
    const outcome = run(['a@example.com', 'b@example.com'], fake.notifications, { warn });

    await expect(outcome).rejects.toThrow(new JobCancelledError('Every address was refused (2)'));
    expect(warn).toHaveBeenCalledWith(
      { sent: 0, refused: 2, alreadyHandled: 0 },
      'Every address was refused',
    );
  });

  it('finishes a retry whose remaining addresses are all refused, once one was sent', async () => {
    const fake = fakeNotifications({
      handled: ['a@example.com'],
      answers: { 'b@example.com': REFUSED },
    });
    await expect(run(['a@example.com', 'b@example.com'], fake.notifications)).resolves.toBe(
      undefined,
    );
  });

  // a was refused, then b failed and the job retried; b is refused now.
  it('ends cancelled when every address was refused, across a retry', async () => {
    const fake = fakeNotifications({
      refusedBefore: ['a@example.com'],
      answers: { 'b@example.com': REFUSED },
    });
    await expect(run(['a@example.com', 'b@example.com'], fake.notifications)).rejects.toThrow(
      new JobCancelledError('Every address was refused (2)'),
    );
    expect(fake.recipients()).toEqual(['b@example.com']);
  });

  it('ends cancelled on a retry with nothing left to send, when every address was refused', async () => {
    const fake = fakeNotifications({ refusedBefore: ['a@example.com'] });
    await expect(run(['a@example.com'], fake.notifications)).rejects.toThrow(
      new JobCancelledError('Every address was refused (1)'),
    );
    expect(fake.emails).toEqual([]);
  });

  it('does nothing for an empty list', async () => {
    const fake = fakeNotifications();
    await expect(run([], fake.notifications)).resolves.toBe(undefined);
    expect(fake.notifications.enabled).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429, 503, null])(
    'stops at an error with status %s and throws without naming addresses, so the job retries',
    async (httpStatus) => {
      const fake = fakeNotifications({
        answers: { 'b@example.com': { outcome: 'error', httpStatus, audited: true } },
      });
      const outcome = run(['a@example.com', 'b@example.com', 'c@example.com'], fake.notifications);

      await expect(outcome).rejects.toThrow(
        `Email send failed (status ${httpStatus ?? 'none'}) after 1 of 3`,
      );
      await expect(outcome).rejects.not.toBeInstanceOf(JobCancelledError);
      expect(fake.recipients()).toEqual(['a@example.com', 'b@example.com']);
    },
  );

  it('says where in the list it stopped, counting refused addresses too', async () => {
    const fake = fakeNotifications({
      answers: {
        'a@example.com': REFUSED,
        'b@example.com': REFUSED,
        'c@example.com': { outcome: 'error', httpStatus: 503, audited: true },
      },
    });
    await expect(
      run(['a@example.com', 'b@example.com', 'c@example.com'], fake.notifications),
    ).rejects.toThrow('Email send failed (status 503) after 2 of 3');
  });

  it('stops and throws when a send was not recorded, so it is not sent again unrecorded', async () => {
    const fake = fakeNotifications({
      answers: { 'a@example.com': { ...ACCEPTED, audited: false } },
    });
    await expect(run(['a@example.com', 'b@example.com'], fake.notifications)).rejects.toThrow(
      'A send was not recorded; stopping after 0 of 2',
    );
    expect(fake.recipients()).toEqual(['a@example.com']);
  });

  it('ends cancelled when notifications turn off part way through', async () => {
    const fake = fakeNotifications({
      answers: { 'b@example.com': { outcome: 'disabled', httpStatus: null, audited: true } },
    });
    await expect(
      run(['a@example.com', 'b@example.com', 'c@example.com'], fake.notifications),
    ).rejects.toThrow(new JobCancelledError('Notifications are off'));
    expect(fake.recipients()).toEqual(['a@example.com', 'b@example.com']);
  });

  it("waits for the daily reset at the provider's limit, keeping the addresses sent before it", async () => {
    const fake = fakeNotifications({
      answers: { 'b@example.com': { outcome: 'limited', httpStatus: 429, audited: true } },
    });
    const sent = run(['a@example.com', 'b@example.com', 'c@example.com'], fake.notifications);
    await expect(sent).rejects.toBeInstanceOf(JobDeferredError);
    await expect(sent).rejects.toThrow(PROVIDER_LIMIT_REACHED);
    expect(fake.recipients()).toEqual(['a@example.com', 'b@example.com']);
  });

  it("throws the runner's abort reason before the next send", async () => {
    const controller = new AbortController();
    const fake = fakeNotifications();
    const sendEmail = fake.notifications.sendEmail;
    fake.notifications.sendEmail = async (email) => {
      const result = await sendEmail(email);
      // The runner aborts with its stop reason as a string.
      controller.abort('lease_lost');
      return result;
    };

    await expect(
      run(['a@example.com', 'b@example.com'], fake.notifications, { signal: controller.signal }),
    ).rejects.toBe('lease_lost');
    expect(fake.recipients()).toEqual(['a@example.com']);
  });
});
