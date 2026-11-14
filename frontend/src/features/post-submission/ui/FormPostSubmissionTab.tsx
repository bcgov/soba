'use client';

import type { Dictionary } from '@/src/types/dictionary';
import { postSubmissionActionUi } from '@/src/features/post-submission/actions/registry';
import { useFormPostSubmissionActions } from '@/src/features/post-submission/data/usePostSubmissionActions';
import FormConfirmationDrawer from '@/src/features/submitter-email-copy/ui/FormConfirmationDrawer';
import { CONFIRMATION_DRAWER_ID } from '@/src/features/submitter-email-copy/constants';
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
  actionsAvailable = true,
  confirmationAvailable = false,
}: Readonly<{
  dict: Dictionary;
  formId: string;
  actionsAvailable?: boolean;
  confirmationAvailable?: boolean;
}>) {
  const { actions, error } = useFormPostSubmissionActions(formId, actionsAvailable);
  return (
    <PostSubmissionActions
      dict={dict}
      intro={dict.postSubmission.formIntro}
      actions={actionsAvailable ? actions : null}
      error={error}
      extraDrawers={
        confirmationAvailable
          ? [
              {
                id: CONFIRMATION_DRAWER_ID,
                node: (
                  <FormConfirmationDrawer
                    key={CONFIRMATION_DRAWER_ID}
                    dict={dict}
                    formId={formId}
                  />
                ),
              },
            ]
          : []
      }
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
