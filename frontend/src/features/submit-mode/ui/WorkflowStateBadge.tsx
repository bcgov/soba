'use client';

type WorkflowStateBadgeProps = {
  state?: string;
  'data-testid'?: string;
};

/**
 * The submission workflow-state pill, shared by the submissions list and the
 * single-submission viewer so the status looks identical in both places. The
 * state text is always rendered (not color-only) for accessibility.
 */
export function WorkflowStateBadge({ state, 'data-testid': testId }: WorkflowStateBadgeProps) {
  const variant = (state || '').toLowerCase() === 'submitted' ? 'text-bg-success' : 'text-bg-secondary';
  return (
    <span className={`badge rounded-pill ${variant}`} data-testid={testId}>
      {(state || '').toUpperCase()}
    </span>
  );
}
