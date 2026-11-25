import { z } from 'zod';

// Refused at discovery: its job's emails names a source of recipients other than its options.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-bad-emails',
  metadata: { code: 'post-submission-test-bad-emails', name: 'Test, bad emails' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'light', emails: { recipients: 'run' }, run: () => Promise.resolve() },
};
