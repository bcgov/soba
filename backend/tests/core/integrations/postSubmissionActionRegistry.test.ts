import path from 'node:path';
import {
  findInstalledPostSubmissionAction,
  findPostSubmissionAction,
  getPostSubmissionActions,
} from '../../../src/core/integrations/post-submission-action/PostSubmissionActionRegistry';
import { getPostSubmissionActionPluginDefinitions } from '../../../src/core/integrations/plugins/PluginRegistry';
import { getJobRegistry } from '../../../src/core/jobs/catalog';
import { log } from '../../../src/core/logging';
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

  it("keeps a plugin's result retention and keep rule, and skips one with a bad value", () => {
    expect(findInstalledPostSubmissionAction('post-submission-test-off')?.job).toEqual(
      expect.objectContaining({ resultRetentionDays: 2, keepResultWhenEnded: true }),
    );
    expect(findInstalledPostSubmissionAction('post-submission-test-bad-retention')).toBeUndefined();
    expect(
      findInstalledPostSubmissionAction('post-submission-test-long-retention'),
    ).toBeUndefined();
    expect(findInstalledPostSubmissionAction('post-submission-test-bad-keep')).toBeUndefined();
  });

  it("keeps a plugin's steps, and skips one with a duplicate, bad or misspelled step", () => {
    expect(findInstalledPostSubmissionAction('post-submission-test-steps')?.steps).toEqual([
      expect.objectContaining({ name: 'send-email', pool: 'light', maxAttempts: 12 }),
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

  it('builds a job type per installed step and warns about enabled codes with no plugin', () => {
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
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
    expect(warn).toHaveBeenCalledWith(
      { codes: ['post-submission-not-installed'] },
      'POST_SUBMISSION_ACTION_PLUGINS names plugins not installed',
    );
    warn.mockRestore();
  });

  it('names a later step by its action, then the step', () => {
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
    expect(listJobTypes()).toEqual(
      expect.arrayContaining([
        { type: 'post-submission-test-steps', name: 'Test, with steps' },
        { type: 'post-submission-test-steps:send-email', name: 'Test, with steps (send-email)' },
      ]),
    );
    warn.mockRestore();
  });
});
