import type { PostSubmissionEmailPackageOptions } from '@soba/lib';
import {
  JobFailedError,
  type PostSubmissionActionContext,
} from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { buildPackageEmail } from './email';

export const DESIGNER_URL_UNSET = 'DESIGNER_APP_URL is not set, so the email would have no link';
export const PACKAGE_GONE = 'The package to link to is gone';

/**
 * The email step: one email to each address, linking to the package the build step stored. It ends
 * dead without a designer URL to link to, or without a package.
 */
export const sendPackageEmail =
  (getDesignerAppUrl: () => string | undefined) =>
  async ({
    options,
    submission,
    previous,
    services,
  }: PostSubmissionActionContext<PostSubmissionEmailPackageOptions>): Promise<void> => {
    const designerAppUrl = getDesignerAppUrl();
    if (!designerAppUrl) throw new JobFailedError(DESIGNER_URL_UNSET);
    if (!previous?.result) throw new JobFailedError(PACKAGE_GONE);
    await services.notifications.sendToEach(
      options.to,
      buildPackageEmail(submission, previous.jobId, previous.result.expiresAt, designerAppUrl),
    );
  };
