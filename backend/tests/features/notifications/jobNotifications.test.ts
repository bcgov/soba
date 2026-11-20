const mockSends = jest.fn();
const mockDay = jest.fn();
jest.mock('../../../src/core/db/repos/notificationAuditRepo', () => ({
  listJobNotificationSends: (...args: unknown[]) => mockSends(...args),
  readEmailDay: (...args: unknown[]) => mockDay(...args),
}));
jest.mock('../../../src/features/notifications/service', () => ({ notificationService: {} }));

import { REFUSED_HTTP_STATUSES } from '../../../src/core/integrations/notification/sendOutcome';
import { getNotificationSettings } from '../../../src/core/integrations/notification/settings';
import type { JobFacts } from '../../../src/core/jobs/facts';
import { jobNotifications } from '../../../src/features/notifications/jobNotifications';

// A job created at 10:00 that sent to two addresses at 11:00, one refused, and was run again at 12:00.
const createdAt = new Date('2026-11-01T10:00:00Z');
const sentAt = new Date('2026-11-01T11:00:00Z');
const rerunAt = new Date('2026-11-01T12:00:00Z');
const SENDS = [
  {
    outcome: 'accepted',
    httpStatus: null,
    recipients: { to: ['kept@example.com'] },
    createdAt: sentAt,
  },
  {
    outcome: 'error',
    httpStatus: 400,
    recipients: { to: ['refused@example.com'] },
    createdAt: sentAt,
  },
];

const handled = (run: JobFacts['run']) =>
  jobNotifications({ id: 'job-1', createdAt, run } as JobFacts, () =>
    Promise.resolve('u1'),
  ).handled();

beforeEach(() => {
  mockSends.mockReset();
  mockSends.mockResolvedValue(SENDS);
});

it("reads the job's sends, and counts every address handled in its first run", async () => {
  await expect(handled({ number: 1, queuedAt: createdAt, queuedBy: 'u1' })).resolves.toEqual({
    recipients: new Set(['kept@example.com', 'refused@example.com']),
    anySent: true,
  });
  expect(mockSends).toHaveBeenCalledWith('job-1');
});

it('tries a refused address again on a re-run', async () => {
  await expect(handled({ number: 2, queuedAt: rerunAt, queuedBy: 'admin-1' })).resolves.toEqual({
    recipients: new Set(['kept@example.com']),
    anySent: true,
  });
});

describe('dailyRoom', () => {
  const { dailyLimit, dailyResetTimeZone } = getNotificationSettings();
  const resetsAt = new Date('2026-11-20T08:00:00Z');
  const dailyRoom = () =>
    jobNotifications({ id: 'job-1' } as JobFacts, () => Promise.resolve('u1')).dailyRoom();

  it("reads the environment's email in the reset zone: the room left and any pause", async () => {
    // The database clock runs an hour behind this process's; the pause has 50 s left.
    const dbNow = new Date(Date.now() - 3_600_000);
    mockDay.mockResolvedValue({
      now: dbNow,
      counted: dailyLimit - 5,
      resetsAt,
      lastLimitedAt: new Date(dbNow.getTime() - 10_000),
      limitedInARow: 1,
    });
    const room = await dailyRoom();
    expect(room.room).toBe(5);
    // Both times move onto this process's clock, an hour ahead of the database's.
    expect(Math.abs(room.resetsAt.getTime() - resetsAt.getTime() - 3_600_000)).toBeLessThan(1000);
    const left = (room.pausedUntil?.getTime() ?? 0) - Date.now();
    expect(left).toBeGreaterThan(45_000);
    expect(left).toBeLessThanOrEqual(50_000);
    expect(mockDay).toHaveBeenCalledWith(dailyResetTimeZone, REFUSED_HTTP_STATUSES);
  });
});
