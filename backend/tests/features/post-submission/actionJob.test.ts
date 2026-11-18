import { z } from 'zod';
import type { PostSubmissionActionPluginDefinition } from '../../../src/core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import {
  actionJobDefinition,
  cancelReason,
  type ActionRunFacts,
} from '../../../src/features/post-submission/actionJob';

jest.mock('../../../src/core/db/client', () => ({ db: {}, quietDb: {} }));

const ready: ActionRunFacts = {
  postSubmissionAvailable: true,
  enabledHere: true,
  featureAvailable: true,
  live: true,
  stillEnabled: true,
};

const plugin = (
  job: Partial<PostSubmissionActionPluginDefinition['job']> = {},
): PostSubmissionActionPluginDefinition => ({
  code: 'post-submission-test',
  metadata: { code: 'post-submission-test', name: 'Test' },
  scopes: ['form'],
  optionsSchema: z.object({}),
  job: { pool: 'heavy', run: () => Promise.resolve(), ...job },
});

describe('cancelReason', () => {
  it('runs the action when every check passes', () => {
    expect(cancelReason(ready)).toBeNull();
  });

  it.each([
    ['postSubmissionAvailable', 'Post-submission is not available for the form'],
    ['enabledHere', 'The action is not enabled in this environment'],
    ['featureAvailable', "The action's feature is not available for the form"],
    ['live', 'The submission, its form or its workspace is gone'],
    ['stillEnabled', 'The action was turned off'],
  ] as const)('cancels when %s fails', (fact, reason) => {
    expect(cancelReason({ ...ready, [fact]: false })).toBe(reason);
  });
});

describe('actionJobDefinition', () => {
  it("takes the job type's settings from the plugin", () => {
    expect(
      actionJobDefinition(
        plugin({
          maxAttempts: 8,
          timeoutMs: 900_000,
          resultRetentionDays: 30,
          keepResultWhenEnded: true,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        type: 'post-submission-test',
        pool: 'heavy',
        maxAttempts: 8,
        timeoutMs: 900_000,
        resultRetentionDays: 30,
        keepResultWhenEnded: true,
      }),
    );
  });

  it('leaves unset what the plugin leaves unset', () => {
    const definition = actionJobDefinition(plugin());
    expect(definition.resultRetentionDays).toBeUndefined();
    expect(definition.keepResultWhenEnded).toBeUndefined();
  });
});
