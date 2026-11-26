'use client';

/**
 * Announces a name check's result. A field's description and error text aren't live regions, so a
 * screen reader would not otherwise hear that the name typed is free or taken.
 */
export function NameCheckAnnouncement({
  announcement,
  testId,
}: Readonly<{ announcement: string; testId: string }>) {
  return (
    <p role="status" aria-live="polite" className="visually-hidden" data-testid={testId}>
      {announcement}
    </p>
  );
}
