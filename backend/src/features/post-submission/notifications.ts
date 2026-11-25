import type { Logger } from 'pino';
import {
  assertCanSend,
  sendEachAddress,
} from '../../core/integrations/notification/sendEachAddress';
import type { PostSubmissionActionNotifications } from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import type { JobFacts } from '../../core/jobs/facts';
import { getSystemUser } from '../../core/services/systemUser';
import { jobNotifications } from '../notifications/jobNotifications';

/** The system user's id; throws when there is none. */
export const systemUserId = async (): Promise<string> => {
  const systemUser = await getSystemUser();
  if (!systemUser) throw new Error('The system user is missing');
  return systemUser.id;
};

/**
 * Email for one action job, sent with `sendEachAddress`. Sends are attributed to the system user,
 * since the submitter chose neither the recipients nor the text.
 */
export const actionNotifications = (
  job: JobFacts,
  signal: AbortSignal,
  log: Logger,
): PostSubmissionActionNotifications => ({
  sendToEach: (addresses, content) =>
    sendEachAddress(
      { notifications: jobNotifications(job, systemUserId), signal, log },
      addresses,
      content,
    ),
  ready: () => assertCanSend({ notifications: jobNotifications(job, systemUserId), signal }),
});
