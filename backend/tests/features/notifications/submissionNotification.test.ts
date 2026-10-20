import { SendEmailSchema } from '../../../src/core/integrations/notification/NotificationAdapter';
import { submissionEmail } from '../../../src/features/notifications/submissionNotification';

const job = {
  workspaceId: 'w1',
  formId: 'f1',
  submissionId: 's1',
  confirmationCode: 'ABC12345',
};

describe('submission email', () => {
  it('addresses one recipient only', () => {
    expect(submissionEmail(job, 'staff@example.com').recipients).toEqual({
      to: ['staff@example.com'],
    });
  });

  it('names the form, the submission and its confirmation code', () => {
    const { body } = submissionEmail(job, 'staff@example.com').content;
    expect(body).toContain('Form ID: f1');
    expect(body).toContain('Submission ID: s1');
    expect(body).toContain('Confirmation code: ABC12345');
  });

  it('is a valid email request', () => {
    expect(SendEmailSchema.safeParse(submissionEmail(job, 'staff@example.com')).success).toBe(true);
  });
});
