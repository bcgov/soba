import path from 'node:path';
import {
  assertPostSubmissionActionsInstalled,
  findInstalledPostSubmissionAction,
  findPostSubmissionAction,
  getPostSubmissionActions,
} from '../../../src/core/integrations/post-submission-action/PostSubmissionActionRegistry';
import { getPostSubmissionActionPluginDefinitions } from '../../../src/core/integrations/plugins/PluginRegistry';
import { getJobRegistry } from '../../../src/core/jobs/catalog';
import { listJobTypes } from '../../../src/core/services/jobViewService';

jest.mock('../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));

const saved = {
  pluginsPath: process.env.PLUGINS_PATH,
  actions: process.env.POST_SUBMISSION_ACTION_PLUGINS,
};

// Discovery is lazy, so these apply as long as nothing has looked for plugins yet.
beforeAll(() => {
  process.env.PLUGINS_PATH = path.resolve(__dirname, '../../fixtures/post-submission-plugins');
  process.env.POST_SUBMISSION_ACTION_PLUGINS =
    'post-submission-test-echo, post-submission-not-installed, post-submission-test-echo';
});

afterAll(() => {
  if (saved.pluginsPath === undefined) delete process.env.PLUGINS_PATH;
  else process.env.PLUGINS_PATH = saved.pluginsPath;
  if (saved.actions === undefined) delete process.env.POST_SUBMISSION_ACTION_PLUGINS;
  else process.env.POST_SUBMISSION_ACTION_PLUGINS = saved.actions;
});

describe('post-submission action plugins', () => {
  it('runs the installed plugins POST_SUBMISSION_ACTION_PLUGINS names, once each', () => {
    expect(getPostSubmissionActions().map((plugin) => plugin.code)).toEqual([
      'post-submission-test-echo',
    ]);
  });

  it('finds an enabled plugin by code, and not one installed but not enabled', () => {
    expect(findPostSubmissionAction('post-submission-test-echo')?.scopes).toEqual([
      'workspace',
      'form',
    ]);
    expect(findPostSubmissionAction('post-submission-test-off')).toBeUndefined();
  });

  it('finds an installed plugin whether or not it is enabled, and not one this pod lacks', () => {
    expect(findInstalledPostSubmissionAction('post-submission-test-off')?.job.pool).toBe('heavy');
    expect(findInstalledPostSubmissionAction('post-submission-not-installed')).toBeUndefined();
  });

  it('skips a plugin with a bad code, nothing to run, or a schema that cannot parse', () => {
    expect(findInstalledPostSubmissionAction('Bad_Code')).toBeUndefined();
    expect(findInstalledPostSubmissionAction('post-submission-test-no-run')).toBeUndefined();
    expect(findInstalledPostSubmissionAction('post-submission-test-no-schema')).toBeUndefined();
  });

  it("keeps a plugin's submits, and skips one with a bad submits or an unknown key", () => {
    expect(findInstalledPostSubmissionAction('post-submission-test-off')?.submits).toBe('first');
    expect(findInstalledPostSubmissionAction('post-submission-test-bad-submits')).toBeUndefined();
    expect(findInstalledPostSubmissionAction('post-submission-test-misspelled')).toBeUndefined();
    expect(
      findInstalledPostSubmissionAction('post-submission-test-misspelled-job'),
    ).toBeUndefined();
  });

  it("keeps a plugin's result retention, and skips one with a bad value", () => {
    expect(findInstalledPostSubmissionAction('post-submission-test-off')?.job).toEqual(
      expect.objectContaining({ resultRetentionDays: 2 }),
    );
    expect(findInstalledPostSubmissionAction('post-submission-test-bad-retention')).toBeUndefined();
    expect(
      findInstalledPostSubmissionAction('post-submission-test-long-retention'),
    ).toBeUndefined();
  });

  it("keeps a plugin's steps, and skips one with a duplicate, bad or misspelled step", () => {
    expect(findInstalledPostSubmissionAction('post-submission-test-steps')?.steps).toEqual([
      expect.objectContaining({
        name: 'send-email',
        pool: 'light',
        maxAttempts: 12,
        emails: { recipients: 'options' },
      }),
    ]);
    expect(
      findInstalledPostSubmissionAction('post-submission-test-steps-duplicate'),
    ).toBeUndefined();
    expect(
      findInstalledPostSubmissionAction('post-submission-test-steps-bad-name'),
    ).toBeUndefined();
    expect(
      findInstalledPostSubmissionAction('post-submission-test-steps-misspelled'),
    ).toBeUndefined();
  });

  it('skips a plugin whose emails name another source of recipients, or a key it does not know', () => {
    expect(findInstalledPostSubmissionAction('post-submission-test-bad-emails')).toBeUndefined();
    expect(
      findInstalledPostSubmissionAction('post-submission-test-misspelled-emails'),
    ).toBeUndefined();
  });

  it('installs one plugin per code when two folders share one', () => {
    expect(
      getPostSubmissionActionPluginDefinitions()
        .map((plugin) => plugin.code)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual([
      'post-submission-test-echo',
      'post-submission-test-off',
      'post-submission-test-steps',
    ]);
  });

  it('stops startup when it names a code with no installed plugin, naming the code', () => {
    expect(() => assertPostSubmissionActionsInstalled()).toThrow(
      'POST_SUBMISSION_ACTION_PLUGINS names plugins that are not installed or did not load: post-submission-not-installed',
    );
    const named = process.env.POST_SUBMISSION_ACTION_PLUGINS;
    process.env.POST_SUBMISSION_ACTION_PLUGINS =
      'post-submission-test-echo, post-submission-test-off';
    try {
      expect(() => assertPostSubmissionActionsInstalled()).not.toThrow();
    } finally {
      process.env.POST_SUBMISSION_ACTION_PLUGINS = named;
    }
  });

  it('builds a job type per installed step', () => {
    const registry = getJobRegistry();
    expect(registry.typesIn('light').sort((a, b) => a.localeCompare(b))).toEqual([
      'post-submission-test-echo',
      'post-submission-test-steps:send-email',
      'submission.email-copy',
      'submission.status-changed',
      'submission.status-email',
      'submission.submitted',
    ]);
    expect(registry.typesIn('heavy').sort((a, b) => a.localeCompare(b))).toEqual([
      'post-submission-test-off',
      'post-submission-test-steps',
      'submission-export',
    ]);
  });

  it('gives the job type of a step that emails its options list its emails, and none to others', () => {
    const registry = getJobRegistry();
    const types = [
      'post-submission-test-steps:send-email',
      'post-submission-test-steps',
      'post-submission-test-echo',
      'submission.status-email',
      'submission.email-copy',
      'submission-export',
    ];
    expect(types.filter((type) => !registry.get(type))).toEqual([]);
    expect(types.filter((type) => registry.get(type)?.emails)).toEqual([
      'post-submission-test-steps:send-email',
    ]);
    expect(registry.get('post-submission-test-steps:send-email')?.emails).toEqual({
      recipients: 'options',
    });
  });

  it('names a later step by its action, then the step', () => {
    expect(listJobTypes()).toEqual(
      expect.arrayContaining([
        { type: 'post-submission-test-steps', name: 'Test, with steps' },
        { type: 'post-submission-test-steps:send-email', name: 'Test, with steps (send-email)' },
      ]),
    );
  });
});
