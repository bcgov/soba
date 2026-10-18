'use client';

import { useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { Button, InlineAlert } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { Modal } from '@/src/components/Modal';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { messageForDataError } from '@/src/shared/api/dataError';
import { templateFileTypeFor } from '@/src/types/templates';
import { printWithStoredTemplate, printWithUploadedTemplate } from '../data/printApi';
import { saveBlob } from '../data/saveBlob';
import { useSubmissionTemplates } from '../data/useSubmissionTemplates';
import { printErrorText } from '../printError';
import { TemplatePrintOptions, type TemplateSource } from './TemplatePrintOptions';

type PrintMethod = 'browser' | 'template';

type PrintSubmissionModalProps = {
  show: boolean;
  submissionId: string;
  onBrowserPrint: () => void;
  onClose: () => void;
};

/** Lets the user choose between the browser's print and a document template print. */
export function PrintSubmissionModal({
  show,
  submissionId,
  onBrowserPrint,
  onClose,
}: Readonly<PrintSubmissionModalProps>) {
  const dict = useDictionary();
  const text = dict.form.templates;
  const { token } = useKeycloak();
  const { templates, isLoading, error: loadError } = useSubmissionTemplates(submissionId);

  const [method, setMethod] = useState<PrintMethod>('browser');
  const [pickedSource, setPickedSource] = useState<TemplateSource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  // A form version holds at most one CDOGS template, so the first is the default.
  const defaultTemplate = templates[0] ?? null;
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

  const templateReady = !isLoading && (source === 'default' || file !== null);
  const canPrint = !printing && (method === 'browser' || templateReady);

  const print = async () => {
    if (method === 'browser') {
      onBrowserPrint();
      return;
    }
    setPrinting(true);
    setPrintError(null);
    try {
      if (source === 'upload' && file) {
        const blob = await printWithUploadedTemplate(token, submissionId, file);
        saveBlob(blob, file.name);
      } else if (defaultTemplate) {
        const blob = await printWithStoredTemplate(token, submissionId, defaultTemplate.id);
        saveBlob(blob, defaultTemplate.filename);
      }
      onClose();
    } catch (e: unknown) {
      setPrintError(
        printErrorText(e, {
          failed: text.print.failed,
          unprocessable: text.print.unprocessable,
          tooLarge: text.uploadTooLarge,
          wrongType: text.uploadWrongType,
          sessionExpired: dict.general.sessionExpired,
          forbidden: dict.general.noAccess,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  const loadErrorText = loadError
    ? messageForDataError(loadError, {
        sessionExpired: dict.general.sessionExpired,
        forbidden: dict.general.noAccess,
        failed: text.loadError,
      })
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
            templates={templates}
            isLoading={isLoading}
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
