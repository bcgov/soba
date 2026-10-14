import { notifySubmission } from '../../../src/features/notifications/submissionNotification';
import { formNotificationSettingsService } from '../../../src/features/form-settings/notification/service';
import { getNotificationAdapter } from '../../../src/core/integrations/plugins/PluginRegistry';
import type { SubmissionRecord } from '../../../src/core/db/repos/submissionRepo';

jest.mock('../../../src/features/form-settings/notification/service', () => ({
  formNotificationSettingsService: { get: jest.fn() },
}));
jest.mock('../../../src/core/integrations/plugins/PluginRegistry', () => ({
  getNotificationAdapter: jest.fn(),
}));
jest.mock('../../../src/core/logging', () => ({ log: { error: jest.fn() } }));
const read = formNotificationSettingsService.get as jest.Mock;
const adapter = getNotificationAdapter as jest.Mock;
const submission = {
  id: 's1',
  formId: 'f1',
  workspaceId: 'w1',
  confirmationCode: 'ABC12345',
} as SubmissionRecord;
describe('submission notification', () => {
  beforeEach(() => jest.clearAllMocks());
  it('does not load the adapter when notifications are disabled', async () => {
    read.mockResolvedValue({ values: { recipients: [] } });
    await notifySubmission(submission);
    expect(adapter).not.toHaveBeenCalled();
  });
  it('sends separately to each configured recipient', async () => {
    read.mockResolvedValue({ values: { recipients: ['a@example.com', 'b@example.com'] } });
    const sendEmail = jest.fn().mockResolvedValue({});
    adapter.mockReturnValue({ sendEmail });
    await notifySubmission(submission);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls.map(([email]) => email.recipients.to)).toEqual([
      ['a@example.com'],
      ['b@example.com'],
    ]);
    expect(sendEmail.mock.calls[0][0].content.body).toContain('ABC12345');
  });
  it('keeps a delivery failure from failing submission and still sends to other recipients', async () => {
    read.mockResolvedValue({ values: { recipients: ['a@example.com', 'b@example.com'] } });
    const sendEmail = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({});
    adapter.mockReturnValue({ sendEmail });
    await expect(notifySubmission(submission)).resolves.toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});
