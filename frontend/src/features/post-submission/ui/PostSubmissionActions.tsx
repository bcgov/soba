'use client';

import type { ReactNode } from 'react';
import { AccordionGroup, InlineAlert } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import type { DataError } from '@/src/shared/api/dataContracts';
import { messageForDataError } from '@/src/shared/api/dataError';
import type { Dictionary } from '@/src/types/dictionary';

/** A drawer shown after the actions, whatever becomes of them, such as the Confirmation Screen. */
export type ExtraDrawer = { id: string; node: ReactNode };

/**
 * The After Submission tab around its drawers: loading, a read that failed, a scope with no actions,
 * or one drawer per action in the server's order. A 404 means post-submission is no longer
 * available here, such as after it was turned off. `actions` null means post-submission is not
 * available, so only the extra drawers show. Extra drawers follow the actions in the same group,
 * and stay when the actions are loading, failed or empty.
 */
export default function PostSubmissionActions<T extends { code: string }>({
  dict,
  intro,
  actions,
  error,
  renderAction,
  extraDrawers = [],
}: Readonly<{
  dict: Dictionary;
  intro: string;
  actions: T[] | undefined | null;
  error: DataError | null;
  renderAction: (action: T) => ReactNode;
  extraDrawers?: readonly ExtraDrawer[];
}>) {
  const t = dict.postSubmission;
  let notice: ReactNode = null;
  if (actions !== null) {
    if (error) {
      notice = (
        <InlineAlert
          variant="warning"
          title={messageForDataError(error, {
            sessionExpired: dict.general.sessionExpired,
            forbidden: dict.general.noAccess,
            notFound: t.notAvailable,
            failed: t.loadError,
          })}
          data-testid="post-submission-load-error"
        />
      );
    } else if (!actions) {
      notice = <CenteredProgress label={dict.general.loading} />;
    } else if (actions.length === 0) {
      notice = <p data-testid="post-submission-empty">{t.empty}</p>;
    }
  }
  const shownActions = actions && !error ? actions : [];

  // With nothing to show after them, the notice stands alone, as it did before extra drawers.
  if (notice && extraDrawers.length === 0) return notice;
  const firstKey = shownActions[0]?.code ?? extraDrawers[0]?.id;
  return (
    <>
      <p data-testid="post-submission-intro">{intro}</p>
      {notice && <div className="mb-3">{notice}</div>}
      {firstKey && (
        <AccordionGroup allowsMultipleExpanded={false} defaultExpandedKeys={[firstKey]}>
          {shownActions.map(renderAction)}
          {extraDrawers.map((drawer) => drawer.node)}
        </AccordionGroup>
      )}
    </>
  );
}
