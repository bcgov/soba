import { isConfirmationSettingAvailable } from '../form-settings/confirmation/availability';
import { notificationService } from '../notifications/service';

/**
 * Whether this environment can send a submitter their copy for the form: the confirmation screen
 * and email copy features are available to it and notifications are on. The form's own setting is
 * the submitter rule's to read.
 */
export const isEmailCopyAvailable = async (scope: {
  workspaceId: string;
  formId: string;
}): Promise<boolean> =>
  (await isConfirmationSettingAvailable('allowSubmitterEmailCopy', scope)) &&
  notificationService.enabled();
