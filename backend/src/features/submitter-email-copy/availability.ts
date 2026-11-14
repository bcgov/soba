import { Features } from '../../core/db/codes';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';
import { notificationService } from '../notifications/service';

/**
 * Whether this environment can send a submitter their copy for the form: the email copy feature is
 * available to it and notifications are on. The form's own setting is the submitter rule's to read.
 */
export const isEmailCopyAvailable = async (scope: {
  workspaceId: string;
  formId: string;
}): Promise<boolean> =>
  (await isFeatureAvailable(Features.submitter_email_copy, scope)) &&
  (await notificationService.enabled());
