import {
  hasConfirmationSettings,
  useConfirmationScreenAvailable,
  type ConfirmationScreenAvailability,
} from '@/src/features/confirmation-screen/data/useConfirmationScreenAvailable';
import { usePostSubmissionAvailable } from './usePostSubmissionAvailable';

/** True when either part is available; undefined while a check that could still say so runs. */
const eitherAvailable = (a: boolean | undefined, b: boolean | undefined): boolean | undefined => {
  if (a || b) return true;
  if (a === undefined || b === undefined) return undefined;
  return false;
};

export interface AfterSubmissionAvailability {
  /** The post-submission actions; undefined while the check runs. */
  actionsAvailable: boolean | undefined;
  /** The Confirmation Screen card; undefined while the checks run. */
  confirmation: ConfirmationScreenAvailability | undefined;
  /** The tab shows where either part is available; undefined while that is not known. */
  tabAvailable: boolean | undefined;
}

/**
 * What the After Submission tab can show for a workspace or a form. Nothing is asked without a
 * scope, such as for a caller without the tab's permission.
 */
export function useAfterSubmissionAvailable(
  scope: { workspaceId: string; formId?: string } | null,
): AfterSubmissionAvailability {
  const actionsAvailable = usePostSubmissionAvailable(scope);
  const confirmation = useConfirmationScreenAvailable(scope);
  return {
    actionsAvailable,
    confirmation,
    tabAvailable: eitherAvailable(actionsAvailable, hasConfirmationSettings(confirmation)),
  };
}
