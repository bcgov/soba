'use client';

import { useRef, useState } from 'react';
import { Button, Form, InlineAlert, TextField } from '@bcgov/design-system-react-components';
import { NormalizedEmailAddressSchema } from '@soba/lib';

import { useDictionary } from '@/app/[lang]/Providers';
import { Modal } from '@/src/components/Modal';
import { apiErrorMessage } from '@/src/shared/api/dataError';
import { fillTemplate } from '@/src/shared/util/stringUtils';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { useSendEmailCopy } from '../data/useSendEmailCopy';

/** The signed-in submitter's address from their sign-in, to start the field with; else blank. */
const signedInEmail = (token: object | undefined): string => {
  const email = token && 'email' in token ? token.email : undefined;
  return typeof email === 'string' ? email : '';
};

/**
 * Emails the submitter a receipt of their submission: its confirmation ID and a link, never its
 * answers. Shown where the server says the submission offers one. The address is the only thing
 * asked for; a signed-in submitter starts with their own.
 */
export function EmailReceiptButton({ submissionId }: Readonly<{ submissionId: string }>) {
  const dict = useDictionary();
  const t = dict.submission.emailReceipt;
  const { authenticated, idTokenParsed } = useKeycloak();
  const sendEmailCopy = useSendEmailCopy(submissionId);
  const { addNotification } = useNotificationStore();

  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const openModal = () => {
    setAddress(authenticated ? signedInEmail(idTokenParsed) : '');
    setFieldError(null);
    setSendError(null);
    setOpen(true);
  };

  const send = async () => {
    if (sendingRef.current) return;
    const parsed = NormalizedEmailAddressSchema.safeParse(address);
    if (!parsed.success) {
      setFieldError(t.invalidAddress);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    try {
      await sendEmailCopy(parsed.data);
      setOpen(false);
      addNotification({ type: 'success', text: fillTemplate(t.sent, { address: parsed.data }) });
    } catch (cause: unknown) {
      setSendError(apiErrorMessage(cause, dict.apiErrors) ?? t.failed);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size="small"
        onPress={openModal}
        data-testid="submission-email-receipt"
      >
        {t.button}
      </Button>
      <Modal
        show={open}
        title={t.title}
        size="md"
        // Held open while sending, so the result lands on the request it belongs to.
        onClose={() => {
          if (!sendingRef.current) setOpen(false);
        }}
        footer={
          <>
            <Button
              variant="primary"
              isPending={sending}
              onPress={() => void send()}
              data-testid="submission-email-receipt-send"
            >
              {t.send}
            </Button>
            <Button
              variant="secondary"
              isDisabled={sending}
              onPress={() => setOpen(false)}
              data-testid="submission-email-receipt-cancel"
            >
              {t.cancel}
            </Button>
          </>
        }
      >
        {/* aria validation: an empty or bad address gets our message, not the browser's popup. */}
        <Form
          validationBehavior="aria"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <p>{t.description}</p>
          {sendError && (
            <InlineAlert
              variant="danger"
              title={sendError}
              data-testid="submission-email-receipt-error"
            />
          )}
          <TextField
            label={t.addressLabel}
            type="email"
            autoComplete="email"
            value={address}
            onChange={(value) => {
              setAddress(value);
              setFieldError(null);
            }}
            isInvalid={!!fieldError}
            errorMessage={fieldError ?? undefined}
            isDisabled={sending}
            isRequired
            data-testid="submission-email-receipt-address"
          />
        </Form>
      </Modal>
    </>
  );
}
