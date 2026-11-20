'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useDictionary } from '@/app/[lang]/Providers';
import { useFormatLongDateTime } from '@/src/shared/hooks/useFormatLongDate';
import type { PrintStatusCode } from '@/src/types/templates';
import { printMarkOf } from '../printMark';

/** Print only: when the page was printed and, for answers not submitted, a watermark. */
export function PrintMarks({ status }: Readonly<{ status: PrintStatusCode }>) {
  const labels = useDictionary().form.templates.print;
  const formatDateTime = useFormatLongDateTime();
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString());

  // flushSync, or the browser prints before the new time renders.
  useEffect(() => {
    const stamp = () => flushSync(() => setPrintedAt(new Date().toISOString()));
    globalThis.addEventListener('beforeprint', stamp);
    return () => globalThis.removeEventListener('beforeprint', stamp);
  }, []);

  const watermark = printMarkOf(status, labels);

  return (
    <div className="d-none d-print-block" data-testid="print-marks">
      <p className="mb-3">{labels.printedAt.replace('{time}', formatDateTime(printedAt))}</p>
      {watermark ? (
        <div className="print-watermark" data-testid="print-watermark">
          {watermark}
        </div>
      ) : null}
    </div>
  );
}
