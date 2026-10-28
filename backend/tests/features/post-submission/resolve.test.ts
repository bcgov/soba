import { z } from 'zod';
import type { PostSubmissionActionPluginDefinition } from '../../../src/core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import type { ActionSettingRow } from '../../../src/features/post-submission/rules';
import { chooseSubmittedActions } from '../../../src/features/post-submission/resolve';

jest.mock('../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));

const plugin = (code: string): PostSubmissionActionPluginDefinition => ({
  code,
  metadata: { code, name: code },
  scopes: ['workspace', 'form'],
  optionsSchema: z.object({}),
  job: { pool: 'light', run: () => Promise.resolve() },
});

const row = (actionCode: string, overrides: Partial<ActionSettingRow> = {}): ActionSettingRow => ({
  id: `${actionCode}-ws`,
  formId: null,
  actionCode,
  inherit: false,
  enabled: true,
  options: { note: actionCode },
  version: 1,
  ...overrides,
});

describe('chooseSubmittedActions', () => {
  it('records each available action its settings turn on, with its options and source', () => {
    expect(
      chooseSubmittedActions([row('post-submission-on')], [plugin('post-submission-on')]),
    ).toEqual([
      {
        code: 'post-submission-on',
        options: { note: 'post-submission-on' },
        source: { scope: 'workspace', settingId: 'post-submission-on-ws', version: 1 },
      },
    ]);
  });

  it('leaves out an action turned off, one with no settings, and settings with no available plugin', () => {
    const rows = [row('post-submission-off', { enabled: false }), row('post-submission-gone')];
    const plugins = [plugin('post-submission-off'), plugin('post-submission-unset')];
    expect(chooseSubmittedActions(rows, plugins)).toEqual([]);
  });

  it("uses a form's override over the workspace default", () => {
    const rows = [
      row('post-submission-on'),
      row('post-submission-on', { id: 'form', formId: 'f1', options: { note: 'form' } }),
    ];
    expect(chooseSubmittedActions(rows, [plugin('post-submission-on')])).toEqual([
      expect.objectContaining({
        options: { note: 'form' },
        source: { scope: 'form', settingId: 'form', version: 1 },
      }),
    ]);
  });

  it('records actions in the order the plugins are enabled', () => {
    const rows = [row('post-submission-b'), row('post-submission-a')];
    const plugins = [plugin('post-submission-a'), plugin('post-submission-b')];
    expect(chooseSubmittedActions(rows, plugins).map((action) => action.code)).toEqual([
      'post-submission-a',
      'post-submission-b',
    ]);
  });
});
