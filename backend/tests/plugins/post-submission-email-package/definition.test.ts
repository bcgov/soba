import {
  POST_SUBMISSION_EMAIL_PACKAGE_CODE,
  PostSubmissionEmailPackageOptionsSchema,
} from '@soba/lib';
import {
  actionStepType,
  findPostSubmissionAction,
} from '../../../src/core/integrations/post-submission-action/PostSubmissionActionRegistry';
import { postSubmissionActionPluginDefinition as plugin } from '../../../src/plugins/post-submission-email-package';

const saved = process.env.POST_SUBMISSION_ACTION_PLUGINS;

beforeAll(() => {
  process.env.POST_SUBMISSION_ACTION_PLUGINS = 'post-submission-email-package';
});

afterAll(() => {
  if (saved === undefined) delete process.env.POST_SUBMISSION_ACTION_PLUGINS;
  else process.env.POST_SUBMISSION_ACTION_PLUGINS = saved;
});

describe('post-submission-email-package', () => {
  it('is discovered from the plugins folder and enabled by its code', () => {
    expect(findPostSubmissionAction('post-submission-email-package')).toMatchObject({
      featureCode: 'post-submission-email-package',
      scopes: ['workspace', 'form'],
      submits: 'first',
      optionsSchema: PostSubmissionEmailPackageOptionsSchema,
    });
  });

  // The download route serves only the result of a job of this type: the build step's.
  it('builds the package as a job typed by its code, in the heavy pool, kept 7 days by default', () => {
    expect(plugin.code).toBe(POST_SUBMISSION_EMAIL_PACKAGE_CODE);
    expect(plugin.job).toMatchObject({
      pool: 'heavy',
      maxAttempts: 8,
      timeoutMs: 900_000,
      resultRetentionDays: 7,
    });
  });

  it('emails in a step of its own in the light pool, retrying for about an hour', () => {
    expect(plugin.steps).toHaveLength(1);
    expect(plugin.steps?.[0]).toMatchObject({
      name: 'email',
      pool: 'light',
      maxAttempts: 8,
      timeoutMs: 300_000,
    });
    expect(actionStepType(plugin.code, 'email')).toBe('post-submission-email-package:email');
  });
});
