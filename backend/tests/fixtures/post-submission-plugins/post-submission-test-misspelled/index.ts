import { z } from 'zod';

// Refused at discovery: it has a key the schema does not know.
export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-misspelled',
  metadata: { code: 'post-submission-test-misspelled', name: 'Test, misspelled key' },
  scopes: ['form'],
  submit: 'first',
  optionsSchema: z.object({}),
  job: { pool: 'light', run: () => Promise.resolve() },
};
