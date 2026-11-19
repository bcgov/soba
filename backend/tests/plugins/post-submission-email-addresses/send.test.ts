import type { Logger } from 'pino';
import type {
  PostSubmissionActionEmailContent,
  PostSubmissionActionJob,
  PostSubmissionActionResult,
  PostSubmissionActionServices,
} from '../../../src/core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { sendNotices } from '../../../src/plugins/post-submission-email-addresses/send';

const submission = {
  id: 's1',
  formId: 'f1',
  formVersionId: 'v1',
  formName: 'Permit application',
  workspaceId: 'w1',
  workspaceName: 'Licensing',
  confirmationCode: 'ABCD1234',
};

/** Sends the notice through a `sendToEach` that records what it was given. */
const run = async (to: string[]) => {
  const calls: { addresses: readonly string[]; content: PostSubmissionActionEmailContent }[] = [];
  const services = {
    notifications: {
      sendToEach: (addresses: readonly string[], content: PostSubmissionActionEmailContent) => {
        calls.push({ addresses, content });
        return Promise.resolve();
      },
    },
  } as PostSubmissionActionServices;
  await sendNotices(
    {
      job: { id: 'job-1' } as PostSubmissionActionJob,
      previous: null,
      options: { to },
      source: { scope: 'form', settingId: 'setting-1', version: 1 },
      submission,
      // The email action uses only notifications, and stores no result.
      services,
      result: {} as PostSubmissionActionResult,
      reportProgress: jest.fn(),
      signal: new AbortController().signal,
      log: { info: jest.fn(), warn: jest.fn() } as unknown as Logger,
    },
    'https://soba.example/designer',
  );
  return calls;
};

describe('sendNotices', () => {
  it('sends the notice to the listed addresses, as HTML, with a link to the submission', async () => {
    const [call, ...others] = await run(['a@example.com', 'b@example.com']);

    expect(others).toEqual([]);
    expect(call.addresses).toEqual(['a@example.com', 'b@example.com']);
    expect(call.content).toMatchObject({
      subject: 'Permit application Submission / Soumission : Permit application (ABCD1234)',
      bodyType: 'html',
    });
    expect(call.content.body).toContain(
      'href="https://soba.example/designer/en/build/f1/submissions/s1"',
    );
  });
});
