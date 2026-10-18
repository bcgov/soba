'use client';

import { useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { Button, InlineAlert } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { Modal } from '@/src/components/Modal';
import { classifyDataError, messageForDataError } from '@/src/shared/api/dataError';
import { useAuthErrorDefaults } from '@/src/shared/api/useDataErrorNotice';
import { templateFileTypeFor, type PrintOptions } from '@/src/types/templates';
import { saveBlob } from '../data/saveBlob';
import type { StaffPrintOptions, SubmissionPrint } from '../data/useSubmissionPrint';
import { printFailureMessages } from '../printError';
import { printFileName } from '../printFileName';
import { TemplatePrintOptions, type TemplateSource } from './TemplatePrintOptions';

type PrintMethod = 'browser' | 'template';

type PrintSubmissionModalProps = {
  show: boolean;
  staff: StaffPrintOptions;
  printTemplate: SubmissionPrint['printTemplate'];
  /** The download's name, without an extension. */
  baseName: string;
  onBrowserPrint: () => void;
  onClose: () => void;
};

/** Lets the user choose between the browser's print and a document template print. */
export function PrintSubmissionModal({
  show,
  staff,
  printTemplate,
  baseName,
  onBrowserPrint,
  onClose,
}: Readonly<PrintSubmissionModalProps>) {
  const dict = useDictionary();
  const text = dict.form.templates;
  const authDefaults = useAuthErrorDefaults();

  const [method, setMethod] = useState<PrintMethod>('browser');
  const [pickedSource, setPickedSource] = useState<TemplateSource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const defaultTemplate = staff.template;
  const source: TemplateSource =
    pickedSource === 'upload' || !defaultTemplate ? 'upload' : 'default';

  const pickSource = (next: TemplateSource) => {
    setPickedSource(next);
    setFile(null);
    setFileError(null);
    setPrintError(null);
  };

  const pickFile = (picked: File | null) => {
    setPrintError(null);
    if (picked && !templateFileTypeFor('cdogs', picked.name)) {
      setFile(null);
      setFileError(text.uploadWrongType);
      return;
    }
    setFile(picked);
    setFileError(null);
  };

  const templateReady = !staff.error && (source === 'default' || file !== null);
  const canPrint = !printing && (method === 'browser' || templateReady);

  const print = async () => {
    if (method === 'browser') {
      onBrowserPrint();
      return;
    }
    setPrinting(true);
    setPrintError(null);
    const options: PrintOptions = { convertTo: 'pdf', reportName: baseName };
    try {
      const rendered =
        source === 'upload' && file
          ? await staff.printUploaded(file, options)
          : await printTemplate(options);
      saveBlob(rendered, printFileName(baseName, rendered));
      onClose();
    } catch (cause: unknown) {
      setPrintError(
        messageForDataError(classifyDataError(cause), {
          ...authDefaults,
          ...printFailureMessages(cause, dict.apiErrors, text.print.failed),
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  const loadErrorText = staff.error
    ? messageForDataError(staff.error, { ...authDefaults, failed: text.loadError })
    : null;

  return (
    <Modal
      show={show}
      title={text.print.modalTitle}
      onClose={onClose}
      size="md"
      isDismissable={!printing}
      footer={
        <>
          <Button
            variant="primary"
            isDisabled={!canPrint}
            onPress={() => void print()}
            data-testid="print-submission-print"
          >
            {printing ? text.print.printing : text.print.print}
          </Button>
          <Button
            variant="secondary"
            isDisabled={printing}
            onPress={onClose}
            data-testid="print-submission-cancel"
          >
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
        <Tab eventKey="browser" title={text.print.browserTab}>
          <div data-testid="print-submission-browser-tab" />
        </Tab>
        <Tab eventKey="template" title={text.print.templateTab}>
          <TemplatePrintOptions
            template={defaultTemplate}
            loadError={loadErrorText}
            source={source}
            onSourceChange={pickSource}
            onFileChange={pickFile}
            fileError={fileError}
            isDisabled={printing}
          />
        </Tab>
      </Tabs>
      {printError ? (
        <InlineAlert
          variant="danger"
          role="alert"
          title={printError}
          data-testid="print-submission-error"
        />
      ) : null}
    </Modal>
  );
}
