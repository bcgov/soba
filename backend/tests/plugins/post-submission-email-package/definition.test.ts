import { POST_SUBMISSION_EMAIL_PACKAGE_CODE } from '@soba/lib';
import { actionStepType } from '../../../src/core/integrations/post-submission-action/PostSubmissionActionRegistry';

const RETENTION = 'PLUGIN_POST_SUBMISSION_EMAIL_PACKAGE_RETENTION_DAYS';
const LISTED = { POST_SUBMISSION_ACTION_PLUGINS: POST_SUBMISSION_EMAIL_PACKAGE_CODE };

// The plugin reads its settings when it loads, and the test setup loads the developer's env files,
// so each case loads fresh modules with only the values it names.
const withEnv = async <T>(
  values: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> => {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const apply = (next: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  apply(values);
  try {
    let result: T | undefined;
    await jest.isolateModulesAsync(async () => {
      const { log } = await import('../../../src/core/logging');
      jest.spyOn(log, 'warn').mockImplementation(() => undefined);
      result = await run();
    });
    return result as T;
  } finally {
    apply(saved);
  }
};

const registry = () =>
  import('../../../src/core/integrations/post-submission-action/PostSubmissionActionRegistry');

const pluginWith = (retention: string | undefined) =>
  withEnv(
    { [RETENTION]: retention },
    async () =>
      (await import('../../../src/plugins/post-submission-email-package'))
        .postSubmissionActionPluginDefinition,
  );

describe('post-submission-email-package', () => {
  it('is discovered from the plugins folder and enabled by its code', async () => {
    const { found, schema } = await withEnv({ [RETENTION]: undefined, ...LISTED }, async () => ({
      found: (await registry()).findPostSubmissionAction(POST_SUBMISSION_EMAIL_PACKAGE_CODE),
      schema: (await import('@soba/lib')).PostSubmissionEmailPackageOptionsSchema,
    }));
    expect(found).toMatchObject({
      featureCode: 'post-submission-email-package',
      scopes: ['workspace', 'form'],
      submits: 'first',
    });
    expect(found?.optionsSchema).toBe(schema);
  });

  it('stops startup where it is listed and its setting is bad', async () => {
    const check = withEnv({ [RETENTION]: '0', ...LISTED }, async () =>
      (await registry()).assertPostSubmissionActionsInstalled(),
    );
    await expect(check).rejects.toThrow(`did not load: ${POST_SUBMISSION_EMAIL_PACKAGE_CODE}`);
  });

  // The download route serves only the result of a job of this type: the build step's.
  it('builds the package as a job typed by its code, in the heavy pool', async () => {
    const plugin = await pluginWith(undefined);
    expect(plugin.code).toBe(POST_SUBMISSION_EMAIL_PACKAGE_CODE);
    expect(plugin.job).toMatchObject({ pool: 'heavy', maxAttempts: 8, timeoutMs: 900_000 });
  });

  it('keeps the package 7 days by default, or the days its setting names', async () => {
    expect((await pluginWith(undefined)).job.resultRetentionDays).toBe(7);
    expect((await pluginWith('14')).job.resultRetentionDays).toBe(14);
  });

  it('emails in a step of its own in the light pool, retrying for about an hour', async () => {
    const plugin = await pluginWith(undefined);
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
