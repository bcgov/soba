const mockSends = jest.fn();
jest.mock('../../../src/core/db/repos/notificationAuditRepo', () => ({
  listJobNotificationSends: (...args: unknown[]) => mockSends(...args),
  countNotificationsSince: jest.fn(),
}));
jest.mock('../../../src/features/notifications/service', () => ({ notificationService: {} }));

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
    runStarted: true,
    anySent: true,
  });
  expect(mockSends).toHaveBeenCalledWith('job-1');
});

it('tries a refused address again on a re-run, and checks its limits again', async () => {
  await expect(handled({ number: 2, queuedAt: rerunAt, queuedBy: 'admin-1' })).resolves.toEqual({
    recipients: new Set(['kept@example.com']),
    runStarted: false,
    anySent: true,
  });
});
