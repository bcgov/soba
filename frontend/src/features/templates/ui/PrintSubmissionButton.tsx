'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { PrintSubmissionModal, type PrintMethod } from './PrintSubmissionModal';

/** Opens the print options for a submission. */
export function PrintSubmissionButton() {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const browserPrintPending = useRef(false);

  // Print only once the modal has closed so it is not in the printout.
  useEffect(() => {
    if (!browserPrintPending.current || open) return;
    browserPrintPending.current = false;
    window.print();
  }, [open]);

  const handlePrint = (method: PrintMethod) => {
    if (method === 'browser') browserPrintPending.current = true;
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="small"
        onPress={() => setOpen(true)}
        data-testid="print-submission-button"
      >
        {dict.form.templates.print.button}
      </Button>
      {open ? (
        <PrintSubmissionModal show onPrint={handlePrint} onCancel={() => setOpen(false)} />
      ) : null}
    </>
  );
}
