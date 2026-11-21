import { z } from 'zod';

// Refused at discovery: two steps share a name, and so a job type.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-steps-duplicate',
  metadata: { code: 'post-submission-test-steps-duplicate', name: 'Test, duplicate step' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'light', run: () => Promise.resolve() },
  steps: [
    { name: 'email', pool: 'light', run: () => Promise.resolve() },
    { name: 'email', pool: 'light', run: () => Promise.resolve() },
  ],
};
