import { z } from 'zod';

// Refused at discovery: its job's resultRetentionDays is not a positive whole number.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-bad-retention',
  metadata: { code: 'post-submission-test-bad-retention', name: 'Test, bad retention' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'heavy', resultRetentionDays: 0, run: () => Promise.resolve() },
};
