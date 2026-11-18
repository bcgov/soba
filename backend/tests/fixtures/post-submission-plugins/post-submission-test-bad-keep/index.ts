import { z } from 'zod';

// Refused at discovery: its job's keepResultWhenEnded is not a boolean.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-bad-keep',
  metadata: { code: 'post-submission-test-bad-keep', name: 'Test, bad keep' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'heavy', keepResultWhenEnded: 'yes', run: () => Promise.resolve() },
};
