import { z } from 'zod';

// Refused at discovery: its job has a key the schema does not know.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-misspelled-job',
  metadata: { code: 'post-submission-test-misspelled-job', name: 'Test, misspelled job key' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'light', maxAttempt: 3, run: () => Promise.resolve() },
};
