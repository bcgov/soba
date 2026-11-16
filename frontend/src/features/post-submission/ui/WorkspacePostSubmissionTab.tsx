'use client';

import type { Dictionary } from '@/src/types/dictionary';
import { postSubmissionActionUi } from '@/src/features/post-submission/actions/registry';
import { useWorkspacePostSubmissionActions } from '@/src/features/post-submission/data/usePostSubmissionActions';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import WorkspaceConfirmationDrawer from '@/src/features/confirmation-screen/ui/WorkspaceConfirmationDrawer';
import { confirmationDrawers } from '@/src/features/confirmation-screen/ui/confirmationDrawers';
import { CONFIRMATION_DRAWER_ID } from '@/src/features/confirmation-screen/constants';
import type { ConfirmationScreenAvailability } from '@/src/features/confirmation-screen/data/useConfirmationScreenAvailable';
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
  actionsAvailable,
  confirmation,
}: Readonly<{
  dict: Dictionary;
  workspaceId: string;
  /** Undefined while the check runs. */
  actionsAvailable: boolean | undefined;
  /** Undefined while the checks run. */
  confirmation: ConfirmationScreenAvailability | undefined;
}>) {
  const { actions, error } = useWorkspacePostSubmissionActions(
    workspaceId,
    actionsAvailable === true,
  );
  if (actionsAvailable === undefined || confirmation === undefined) {
    return <CenteredProgress label={dict.general.loading} />;
  }
  return (
    <PostSubmissionActions
      dict={dict}
      intro={dict.postSubmission.workspaceIntro}
      actions={actionsAvailable ? actions : null}
      error={error}
      extraDrawers={confirmationDrawers(
        confirmation,
        <WorkspaceConfirmationDrawer
          key={CONFIRMATION_DRAWER_ID}
          dict={dict}
          workspaceId={workspaceId}
          availability={confirmation}
        />,
      )}
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
