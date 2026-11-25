import {
  PostSubmissionEmailAddressesOptionsSchema,
  type PostSubmissionEmailAddressesOptions,
} from '@soba/lib';
import { env, JobPool } from '../../core/config/env';
import { Features } from '../../core/db/codes';
import type { PostSubmissionActionPluginDefinition } from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { buildNotice } from './notice';

const CODE = 'post-submission-email-addresses';

/** Emails a fixed notice to a list of addresses when a form receives a submission. */
export const postSubmissionActionPluginDefinition: PostSubmissionActionPluginDefinition<PostSubmissionEmailAddressesOptions> =
  {
    code: CODE,
    metadata: {
      code: CODE,
      name: 'Email a list of addresses',
      description: 'Emails a notice to a list of addresses when the form receives a submission',
    },
    featureCode: Features.post_submission_email,
    scopes: ['workspace', 'form'],
    optionsSchema: PostSubmissionEmailAddressesOptionsSchema,
    job: {
      pool: JobPool.light,
      emails: { recipients: 'options' },
      // About an hour of retries at the default backoff, to ride out a provider outage.
      maxAttempts: 8,
      timeoutMs: 300_000,
      // One email per listed address not yet handled for this job, within the daily email limit.
      run: ({ options, submission, services }) =>
        services.notifications.sendToEach(
          options.to,
          buildNotice(submission, env.getDesignerAppUrl()),
        ),
    },
  };
