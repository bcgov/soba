'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { PrintSubmissionModal } from './PrintSubmissionModal';

type PrintSubmissionButtonProps = {
  submissionId: string;
  /** The on-screen answers to print instead of the saved ones. */
  getLiveData?: () => Record<string, unknown>;
};

/** Opens the print options for a submission. */
export function PrintSubmissionButton({
  submissionId,
  getLiveData,
}: Readonly<PrintSubmissionButtonProps>) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const browserPrintPending = useRef(false);

  // Print only once the modal has closed so it is not in the printout.
  useEffect(() => {
    if (!browserPrintPending.current || open) return;
    browserPrintPending.current = false;
    window.print();
  }, [open]);

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
        <PrintSubmissionModal
          show
          submissionId={submissionId}
          getLiveData={getLiveData}
          onBrowserPrint={() => {
            browserPrintPending.current = true;
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
