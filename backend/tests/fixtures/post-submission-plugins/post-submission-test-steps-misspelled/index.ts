import { z } from 'zod';

// Refused at discovery: a step has a key the schema does not know.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-steps-misspelled',
  metadata: { code: 'post-submission-test-steps-misspelled', name: 'Test, misspelled step key' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'light', run: () => Promise.resolve() },
  steps: [{ name: 'email', pool: 'light', maxAttempt: 3, run: () => Promise.resolve() }],
};
