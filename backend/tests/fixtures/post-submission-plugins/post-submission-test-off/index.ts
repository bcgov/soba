import { z } from 'zod';

export const postSubmissionActionPluginDefinition = {
  code: 'post-submission-test-off',
  metadata: { code: 'post-submission-test-off', name: 'Test, not enabled' },
  scopes: ['form'],
  submits: 'first',
  optionsSchema: z.object({}),
  job: {
    pool: 'heavy',
    resultRetentionDays: 2,
    run: () => Promise.resolve(),
  },
};
