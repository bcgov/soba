import { z } from 'zod';

// Refused at discovery: its job's emails holds a key the loader does not know.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-misspelled-emails',
  metadata: { code: 'post-submission-test-misspelled-emails', name: 'Test, misspelled emails' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: {
    pool: 'light',
    emails: { recipients: 'options', recipient: 'options' },
    run: () => Promise.resolve(),
  },
};
