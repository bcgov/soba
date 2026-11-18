import { z } from 'zod';

// Refused at discovery: its job's resultRetentionDays is over 36500.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-long-retention',
  metadata: { code: 'post-submission-test-long-retention', name: 'Test, long retention' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'heavy', resultRetentionDays: 36_501, run: () => Promise.resolve() },
};
