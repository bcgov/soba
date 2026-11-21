import { z } from 'zod';

// Refused at discovery: submits is neither 'every' nor 'first'.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-bad-submits',
  metadata: { code: 'post-submission-test-bad-submits', name: 'Test, bad submits' },
  scopes: ['form'],
  submits: 'second',
  optionsSchema: z.object({}),
  job: { pool: 'light', run: () => Promise.resolve() },
};
