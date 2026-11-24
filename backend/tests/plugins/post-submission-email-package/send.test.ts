import type { PostSubmissionEmailPackageOptions } from '@soba/lib';
import {
  JobFailedError,
  type PostSubmissionActionContext,
  type PostSubmissionActionPreviousStep,
} from '../../../src/core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import {
  DESIGNER_URL_UNSET,
  PACKAGE_GONE,
  sendPackageEmail,
} from '../../../src/plugins/post-submission-email-package/send';

const DESIGNER = 'https://soba.example/designer';
const EXPIRES = new Date('2026-07-15T17:28:22Z');

/** An email step's context whose notifications record what they were asked to send. */
const emailStep = (previous: PostSubmissionActionPreviousStep | null) => {
  const sendToEach = jest.fn(() => Promise.resolve());
  const context = {
    job: {
      id: 'job-2',
      type: 'post-submission-email-package:email',
      submissionId: 's1',
      revisionId: 'r1',
    },
    previous,
    options: { to: ['staff@example.com', 'lead@example.com'] },
    submission: {
      id: 's1',
      formId: 'f1',
      formVersionId: 'v1',
      formName: 'Permit application',
      workspaceId: 'w1',
      workspaceName: 'Licensing',
      confirmationCode: 'ABCD1234',
    },
    services: { notifications: { sendToEach } },
  } as unknown as PostSubmissionActionContext<PostSubmissionEmailPackageOptions>;
  return { context, sendToEach };
};

const BUILT: PostSubmissionActionPreviousStep = {
  jobId: 'job-1',
  result: {
    filename: 'Permit application-ABCD1234.zip',
    size: 719,
    contentType: 'application/zip',
    expiresAt: EXPIRES,
  },
};

describe('sendPackageEmail', () => {
  it("emails each address a link to the build step's package", async () => {
    const { context, sendToEach } = emailStep(BUILT);

    await sendPackageEmail(() => DESIGNER)(context);

    expect(sendToEach).toHaveBeenCalledTimes(1);
    expect(sendToEach).toHaveBeenCalledWith(
      ['staff@example.com', 'lead@example.com'],
      expect.objectContaining({
        body: expect.stringContaining('/en/build/f1/submissions/s1/packages/job-1"'),
      }),
    );
  });

  it('ends dead, sending nothing, without a designer URL to link to', async () => {
    const { context, sendToEach } = emailStep(BUILT);

    const failed = await sendPackageEmail(() => undefined)(context).catch((err: unknown) => err);

    expect(failed).toBeInstanceOf(JobFailedError);
    expect((failed as Error).message).toBe(DESIGNER_URL_UNSET);
    expect(sendToEach).not.toHaveBeenCalled();
  });

  it('ends dead, sending nothing, when the package is gone', async () => {
    const { context, sendToEach } = emailStep({ jobId: 'job-1', result: null });

    const failed = await sendPackageEmail(() => DESIGNER)(context).catch((err: unknown) => err);

    expect(failed).toBeInstanceOf(JobFailedError);
    expect((failed as Error).message).toBe(PACKAGE_GONE);
    expect(sendToEach).not.toHaveBeenCalled();
  });
});
