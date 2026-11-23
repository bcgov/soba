'use client';

import { InlineAlert } from '@bcgov/design-system-react-components';
import type {
  ActionScope,
  PostSubmissionActionUi,
} from '@/src/features/post-submission/actions/types';
import type { DataError } from '@/src/shared/api/dataContracts';
import { messageForDataError } from '@/src/shared/api/dataError';
import type { Dictionary } from '@/src/types/dictionary';
import styles from './ActionDrawerIntro.module.css';

/** What an action does, its notes for the scope, and why its settings did not load, if so. */
export default function ActionDrawerIntro({
  dict,
  id,
  ui,
  scope,
  error,
}: Readonly<{
  dict: Dictionary;
  id: string;
  ui: PostSubmissionActionUi;
  scope: ActionScope;
  error: DataError | null;
}>) {
  const notices = ui.notices?.(dict, scope) ?? [];
  return (
    <>
      <p data-testid={`${id}-description`}>{ui.description(dict)}</p>
      {(notices.length > 0 || error) && (
        <div className={styles.alerts}>
          {/* An action's notices are a fixed list, and two may share their text. */}
          {notices.map((notice, index) => (
            <InlineAlert
              key={index}
              variant={notice.variant}
              data-testid={`${id}-notice-${index + 1}`}
            >
              {notice.text}
            </InlineAlert>
          ))}
          {error && (
            <InlineAlert
              variant="warning"
              title={messageForDataError(error, {
                sessionExpired: dict.general.sessionExpired,
                forbidden: dict.general.noAccess,
                failed: dict.postSubmission.settingsLoadError,
              })}
              data-testid={`${id}-error`}
            />
          )}
        </div>
      )}
    </>
  );
}
