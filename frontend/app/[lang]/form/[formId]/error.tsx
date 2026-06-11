'use client';

/**
 * Segment error UI for `/[lang]/forms/[formId]` only.
 *
 * Today: catches uncaught errors in this route segment (including escaped RSC/client failures).
 * The Form.io tree also uses `FormioV5FormRenderErrorBoundary` for renderer-local throws.
 *
 * Forward: add `app/[lang]/error.tsx` or `app/error.tsx`, extract shared fallback (alert + reset),
 * and optionally report `error.digest` / `captureException` to observability.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useDictionary } from '@/app/[lang]/Providers';

export default function FormIdRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = typeof params?.lang === 'string' ? params.lang : 'en';
  const dict = useDictionary();
  const labels = dict.formioV5.formRender.segmentError;

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[forms/[formId]/error]', error);
    }
  }, [error]);

  return (
    <div className="mt-4" role="alert">
      <Alert variant="danger">{labels.title}</Alert>
      <div className="d-flex flex-wrap gap-3">
        <Button type="button" variant="primary" onClick={() => reset()}>
          {labels.tryAgain}
        </Button>
        <Link
          className="text-[var(--theme-primary-blue)] underline hover:no-underline"
          href={`/${locale}/forms`}
        >
          {labels.backToList}
        </Link>
      </div>
    </div>
  );
}
