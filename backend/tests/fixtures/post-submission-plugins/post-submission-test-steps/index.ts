import { z } from 'zod';

export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-steps',
  metadata: { code: 'post-submission-test-steps', name: 'Test, with steps' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'heavy', run: () => Promise.resolve() },
  steps: [
    {
      name: 'send-email',
      pool: 'light',
      maxAttempts: 12,
      emails: { recipients: 'options' },
      run: () => Promise.resolve(),
    },
  ],
};
