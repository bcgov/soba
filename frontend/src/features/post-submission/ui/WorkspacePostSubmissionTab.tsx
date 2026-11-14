'use client';

import type { Dictionary } from '@/src/types/dictionary';
import { postSubmissionActionUi } from '@/src/features/post-submission/actions/registry';
import { useWorkspacePostSubmissionActions } from '@/src/features/post-submission/data/usePostSubmissionActions';
import WorkspaceConfirmationDrawer from '@/src/features/submitter-email-copy/ui/WorkspaceConfirmationDrawer';
import { CONFIRMATION_DRAWER_ID } from '@/src/features/submitter-email-copy/constants';
import PostSubmissionActions from './PostSubmissionActions';
import UnknownActionDrawer from './UnknownActionDrawer';
import WorkspaceActionDrawer from './WorkspaceActionDrawer';

/**
 * A workspace's After Submission tab: what happens when its forms receive submissions, and what
 * their confirmation screen offers. Each part shows only where its feature is available.
 */
export default function WorkspacePostSubmissionTab({
  dict,
  workspaceId,
  actionsAvailable = true,
  confirmationAvailable = false,
}: Readonly<{
  dict: Dictionary;
  workspaceId: string;
  actionsAvailable?: boolean;
  confirmationAvailable?: boolean;
}>) {
  const { actions, error } = useWorkspacePostSubmissionActions(workspaceId, actionsAvailable);
  return (
    <PostSubmissionActions
      dict={dict}
      intro={dict.postSubmission.workspaceIntro}
      actions={actionsAvailable ? actions : null}
      error={error}
      extraDrawers={
        confirmationAvailable
          ? [
              {
                id: CONFIRMATION_DRAWER_ID,
                node: (
                  <WorkspaceConfirmationDrawer
                    key={CONFIRMATION_DRAWER_ID}
                    dict={dict}
                    workspaceId={workspaceId}
                  />
                ),
              },
            ]
          : []
      }
      renderAction={(action) => {
        const ui = postSubmissionActionUi(action.code);
        return ui ? (
          <WorkspaceActionDrawer
            key={action.code}
            dict={dict}
            workspaceId={workspaceId}
            code={action.code}
            ui={ui}
          />
        ) : (
          <UnknownActionDrawer
            key={action.code}
            dict={dict}
            code={action.code}
            name={action.name}
            description={action.description}
            enabled={action.settings.values.enabled}
          />
        );
      }}
    />
  );
}
