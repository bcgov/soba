import {
  POST_SUBMISSION_EMAIL_PACKAGE_CODE,
  POST_SUBMISSION_EMAIL_PACKAGE_EMAIL_STEP,
  PostSubmissionEmailPackageOptionsSchema,
  type PostSubmissionEmailPackageOptions,
} from '@soba/lib';
import { env, JobPool } from '../../core/config/env';
import { Features } from '../../core/db/codes';
import type { PostSubmissionActionPluginDefinition } from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { buildPackage } from './build';
import { sendPackageEmail } from './send';
import { resolvePackageSettings } from './settings';

// Read when the plugin loads. A bad value keeps it from loading, which stops startup wherever
// POST_SUBMISSION_ACTION_PLUGINS lists it.
const settings = resolvePackageSettings(process.env);

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
    // Typed by the action's code, the job type whose result the package download serves.
    job: {
      pool: JobPool.heavy,
      // About an hour of retries at the default backoff, to ride out a document generation or
      // storage outage. A package within its limit builds in well under the timeout, so a timeout
      // is a stall, and the retries keep one from holding the heavy pool for long.
      maxAttempts: 8,
      timeoutMs: 300_000,
      resultRetentionDays: settings.retentionDays,
      run: buildPackage(settings),
    },
    steps: [
      {
        name: POST_SUBMISSION_EMAIL_PACKAGE_EMAIL_STEP,
        pool: JobPool.light,
        // About an hour of retries at the default backoff, to ride out a provider outage.
        maxAttempts: 8,
        timeoutMs: 300_000,
        run: sendPackageEmail(() => env.getDesignerAppUrl()),
      },
    ],
  };
