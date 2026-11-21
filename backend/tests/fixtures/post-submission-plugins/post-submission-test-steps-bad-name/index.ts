import { z } from 'zod';

// Refused at discovery: a step name that is not lowercase words joined by dashes.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-steps-bad-name',
  metadata: { code: 'post-submission-test-steps-bad-name', name: 'Test, bad step name' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'light', run: () => Promise.resolve() },
  steps: [{ name: 'Send:Email', pool: 'light', run: () => Promise.resolve() }],
};
