import type { PostSubmissionEmailAddressesOptions } from '@soba/lib';
import type { PostSubmissionActionContext } from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { buildNotice } from './notice';

type SendContext = PostSubmissionActionContext<PostSubmissionEmailAddressesOptions>;

/**
 * Sends the notice to each listed address not yet handled for this job, one email per address,
 * within the environment's daily email limit.
 */
export const sendNotices = (
  { options, submission, services }: SendContext,
  designerAppUrl: string | undefined,
): Promise<void> =>
  services.notifications.sendToEach(options.to, buildNotice(submission, designerAppUrl));
