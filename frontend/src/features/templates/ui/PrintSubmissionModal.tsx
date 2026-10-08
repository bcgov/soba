'use client';

import { useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { Button } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { Modal } from '@/src/components/Modal';

export type PrintMethod = 'browser' | 'template';

type PrintSubmissionModalProps = {
  show: boolean;
  onPrint: (method: PrintMethod) => void;
  onCancel: () => void;
};

/** Lets the user choose between the browser's print and a document template print. */
export function PrintSubmissionModal({
  show,
  onPrint,
  onCancel,
}: Readonly<PrintSubmissionModalProps>) {
  const dict = useDictionary();
  const dictPrint = dict.form.templates.print;
  const [method, setMethod] = useState<PrintMethod>('browser');

  return (
    <Modal
      show={show}
      title={dictPrint.modalTitle}
      onClose={onCancel}
      size="md"
      footer={
        <>
          <Button
            variant="primary"
            isDisabled={method === 'template'}
            onPress={() => onPrint(method)}
            data-testid="print-submission-print"
          >
            {dictPrint.print}
          </Button>
          <Button variant="secondary" onPress={onCancel} data-testid="print-submission-cancel">
            {dict.general.cancel}
          </Button>
        </>
      }
    >
      <Tabs
        id="print-submission-tabs"
        activeKey={method}
        onSelect={(key) => setMethod(key === 'template' ? 'template' : 'browser')}
        className="mb-3"
        data-testid="print-submission-tabs"
      >
        <Tab eventKey="browser" title={dictPrint.browserTab}>
          <div data-testid="print-submission-browser-tab" />
        </Tab>
        <Tab eventKey="template" title={dictPrint.templateTab}>
          <div data-testid="print-submission-template-tab" />
        </Tab>
      </Tabs>
    </Modal>
  );
}
