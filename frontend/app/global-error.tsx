'use client';

/**
 * Root-level error UI. Must define its own <html>/<body> (it replaces the root layout).
 * Providing this file avoids Next.js prerender failures on the internal `/_global-error` route.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
        {error.digest ? <p>Reference: {error.digest}</p> : null}
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  );
}
