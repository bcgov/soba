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

// Read when the plugin loads. A bad value keeps it from loading, which stops startup wherever
// POST_SUBMISSION_ACTION_PLUGINS lists it.
const settings = resolvePackageSettings(process.env);

const notBuilt = (): Promise<void> => Promise.reject(new JobFailedError('Not built yet'));

/** The email-package action's definition; neither step is built yet. */
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
    // Typed by the action's code, the job type whose result the package download serves.
    job: {
      pool: JobPool.heavy,
      // About an hour of retries at the default backoff, to ride out a document generation or
      // storage outage.
      maxAttempts: 8,
      timeoutMs: 900_000,
      resultRetentionDays: settings.retentionDays,
      run: notBuilt,
    },
    steps: [
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
