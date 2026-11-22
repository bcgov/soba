import {
  POST_SUBMISSION_EMAIL_PACKAGE_CODE,
  PostSubmissionEmailPackageOptionsSchema,
  type PostSubmissionEmailPackageOptions,
} from '@soba/lib';
import { JobPool } from '../../core/config/env';
import { Features } from '../../core/db/codes';
import {
  JobFailedError,
  type PostSubmissionActionPluginDefinition,
} from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { resolvePackageSettings } from './settings';

// Read when the plugin loads; a value out of range keeps it from loading.
const settings = resolvePackageSettings(process.env);

const notBuilt = (): Promise<void> => Promise.reject(new JobFailedError('Not built yet'));

/** Emails staff a link to a package of a submission when it is first submitted. */
export const postSubmissionActionPluginDefinition: PostSubmissionActionPluginDefinition<PostSubmissionEmailPackageOptions> =
  {
    code: POST_SUBMISSION_EMAIL_PACKAGE_CODE,
    metadata: {
      code: POST_SUBMISSION_EMAIL_PACKAGE_CODE,
      name: 'Submit to Email',
      description: 'Emails staff a link to a package of a submission when it is first submitted',
    },
    featureCode: Features.post_submission_email_package,
    scopes: ['workspace', 'form'],
    submits: 'first',
    optionsSchema: PostSubmissionEmailPackageOptionsSchema,
    // Builds the package and stores it as the job's result.
    job: {
      pool: JobPool.heavy,
      maxAttempts: 8,
      timeoutMs: 900_000,
      resultRetentionDays: settings.retentionDays,
      run: notBuilt,
    },
    steps: [
      // Emails each address a link to the package.
      {
        name: 'email',
        pool: JobPool.light,
        // About an hour of retries at the default backoff, to ride out a provider outage.
        maxAttempts: 8,
        timeoutMs: 300_000,
        run: notBuilt,
      },
    ],
  };
