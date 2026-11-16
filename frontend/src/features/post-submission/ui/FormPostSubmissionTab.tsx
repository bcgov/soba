'use client';

import type { Dictionary } from '@/src/types/dictionary';
import { postSubmissionActionUi } from '@/src/features/post-submission/actions/registry';
import { useFormPostSubmissionActions } from '@/src/features/post-submission/data/usePostSubmissionActions';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import FormConfirmationDrawer from '@/src/features/confirmation-screen/ui/FormConfirmationDrawer';
import { confirmationDrawers } from '@/src/features/confirmation-screen/ui/confirmationDrawers';
import { CONFIRMATION_DRAWER_ID } from '@/src/features/confirmation-screen/constants';
import type { ConfirmationScreenAvailability } from '@/src/features/confirmation-screen/data/useConfirmationScreenAvailable';
import FormActionDrawer from './FormActionDrawer';
import PostSubmissionActions from './PostSubmissionActions';
import UnknownActionDrawer from './UnknownActionDrawer';

/**
 * A form's After Submission tab: what happens each time the form receives a submission, and what its
 * confirmation screen offers. Each part shows only where its feature is available.
 */
export default function FormPostSubmissionTab({
  dict,
  formId,
  actionsAvailable,
  confirmation,
}: Readonly<{
  dict: Dictionary;
  formId: string;
  /** Undefined while the check runs. */
  actionsAvailable: boolean | undefined;
  /** Undefined while the checks run. */
  confirmation: ConfirmationScreenAvailability | undefined;
}>) {
  const { actions, error } = useFormPostSubmissionActions(formId, actionsAvailable === true);
  if (actionsAvailable === undefined || confirmation === undefined) {
    return <CenteredProgress label={dict.general.loading} />;
  }
  return (
    <PostSubmissionActions
      dict={dict}
      intro={dict.postSubmission.formIntro}
      actions={actionsAvailable ? actions : null}
      error={error}
      extraDrawers={confirmationDrawers(
        confirmation,
        <FormConfirmationDrawer
          key={CONFIRMATION_DRAWER_ID}
          dict={dict}
          formId={formId}
          availability={confirmation}
        />,
      )}
      renderAction={(action) => {
        const ui = postSubmissionActionUi(action.code);
        return ui ? (
          <FormActionDrawer key={action.code} dict={dict} formId={formId} action={action} ui={ui} />
        ) : (
          <UnknownActionDrawer
            key={action.code}
            dict={dict}
            code={action.code}
            name={action.name}
            description={action.description}
            enabled={action.settings.effective.enabled}
            note={
              action.scopes.includes('form') ? undefined : dict.postSubmission.workspaceOnlyNote
            }
          />
        );
      }}
    />
  );
}
