'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@bcgov/design-system-react-components';
import { FiAlertTriangle, FiExternalLink, FiInfo } from 'react-icons/fi';
import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { Modal } from '@/src/components/Modal';
import { ConfirmModal } from '@/src/components/ConfirmModal';
import { isForbidden, isSessionExpired } from '@/src/shared/api/dataError';
import { useCredential } from '../data/useCredential';
import type { CredentialSecret } from '../data/api';
import styles from './WorkspaceApiKey.module.css';

type Links = { helpUrl?: string; revokeUrl?: string };

function ApiKeySection({
  workspaceId,
  helpUrl,
  revokeUrl,
}: Readonly<{ workspaceId: string } & Links>) {
  const dict = useDictionary();
  const text = dict.apiKeys;
  const resource = useCredential(workspaceId);
  const [secret, setSecret] = useState<CredentialSecret | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const message = (err: unknown, fallback: string) => {
    if (isForbidden(err)) return text.forbidden;
    if (isSessionExpired(err)) return text.sessionExpired;
    return fallback;
  };
  const close = () => {
    if (inFlight.current) return;
    setSecret(null);
    setNotes('');
    setCopied(false);
    setDialogError('');
  };
  const generate = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setConfirm(false);
    try {
      const result = await resource.generate();
      if (mounted.current) {
        setSecret(result);
        setNotes(result.credential.notes);
        setCopied(false);
        setDialogError('');
      }
    } catch (err) {
      if (mounted.current) setError(message(err, text.actionError));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const done = async () => {
    if (!secret || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setDialogError('');
    try {
      if (notes !== secret.credential.notes) await resource.saveNotes(secret.credential.id, notes);
      if (mounted.current) {
        setSecret(null);
        setNotes('');
        setCopied(false);
      }
    } catch (err) {
      if (mounted.current) setDialogError(message(err, text.saveError));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.apiKey);
      if (mounted.current) setCopied(true);
    } catch {
      if (mounted.current) setDialogError(text.copyError);
    }
  };
  const credential = resource.data?.credential;
  const pending = credential && credential.status !== 'active';
  const actionLabel = credential ? text.regenerate : text.generate;
  const date = credential ? new Date(credential.rotatedAt ?? credential.createdAt) : null;
  return (
    <section
      className={styles.section}
      aria-labelledby="workspace-api-key-heading"
      aria-busy={busy}
    >
      <h3 id="workspace-api-key-heading" className={styles.heading}>
        {text.heading}{' '}
        <span title={text.info} tabIndex={0} role="img" aria-label={text.info}>
          <FiInfo aria-hidden="true" />
        </span>
      </h3>
      {resource.demo && <p role="status">{text.demo}</p>}
      {resource.isLoading && <p role="status">{dict.general.loading}</p>}
      {(error || resource.error) && (
        <p role="alert">{error || message(resource.error, text.loadError)}</p>
      )}
      {credential && date && (
        <>
          <p className={styles.created}>
            {text.created
              .replace(
                '{date}',
                new Intl.DateTimeFormat(dict.locale, { dateStyle: 'medium' }).format(date),
              )
              .replace(
                '{time}',
                new Intl.DateTimeFormat(dict.locale, { timeStyle: 'medium' }).format(date),
              )}
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{text.label}</th>
                <th scope="col">{text.notes}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{credential.label}</td>
                <td>{credential.notes || '—'}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
      {pending && <p role="status">{text.pending}</p>}
      {resource.data && !resource.data.available && <p role="status">{text.unavailable}</p>}
      <Button
        variant="secondary"
        isDisabled={
          busy ||
          resource.isLoading ||
          !resource.data?.available ||
          Boolean(pending) ||
          Boolean(resource.error)
        }
        onPress={() => (credential ? setConfirm(true) : void generate())}
      >
        {busy ? text.working : actionLabel}
      </Button>
      {(pending || error || resource.error) && (
        <div className={styles.refresh}>
          <Button
            variant="secondary"
            isDisabled={busy}
            onPress={() => {
              setError('');
              void resource.refresh();
            }}
          >
            {text.refresh}
          </Button>
        </div>
      )}
      {helpUrl && (
        <p className={styles.link}>
          <a href={helpUrl} target="_blank" rel="noopener noreferrer">
            {text.learn} <FiExternalLink aria-hidden="true" />
          </a>
        </p>
      )}
      {revokeUrl && (
        <p className={styles.link}>
          <a href={revokeUrl} target="_blank" rel="noopener noreferrer">
            {text.revoke} <FiExternalLink aria-hidden="true" />
          </a>
        </p>
      )}
      <ConfirmModal
        show={confirm}
        title={text.confirmTitle}
        message={text.confirmBody}
        confirmLabel={text.regenerate}
        onConfirm={() => void generate()}
        onCancel={() => setConfirm(false)}
        pending={busy}
      />
      {secret && (
        <Modal
          show
          title={credential?.rotatedAt ? text.regenerate : text.generate}
          size="md"
          onClose={close}
          isDismissable={!busy}
          isCloseable={!busy}
          footer={
            <Button variant="primary" isDisabled={busy} onPress={() => void done()}>
              {busy ? text.working : text.done}
            </Button>
          }
        >
          <div className={styles.warning} role="note">
            <FiAlertTriangle aria-hidden="true" />
            <div>
              <strong>{text.onceTitle}</strong>
              <p>{text.onceBody}</p>
            </div>
          </div>
          <label htmlFor="generated-api-key" className={styles.keyLabel}>
            {text.yourKey}
          </label>
          <input
            id="generated-api-key"
            className={styles.key}
            value={secret.apiKey}
            readOnly
            autoComplete="off"
            spellCheck={false}
          />
          <Button variant="secondary" onPress={() => void copy()}>
            {text.copy}
          </Button>
          {copied && <p role="status">{text.copied}</p>}
          <label htmlFor="api-key-notes" className={styles.notesLabel}>
            {text.notes}
          </label>
          <textarea
            id="api-key-notes"
            className={styles.notes}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={text.notesPlaceholder}
            maxLength={1000}
            disabled={busy}
            aria-describedby="api-key-notes-hint"
          />
          <p id="api-key-notes-hint" className={styles.hint}>
            {text.notesHint}
          </p>
          {dialogError && <p role="alert">{dialogError}</p>}
        </Modal>
      )}
    </section>
  );
}

export default function WorkspaceApiKey({
  workspaceId,
  ...links
}: Readonly<{ workspaceId: string } & Links>) {
  const { authenticated, idTokenParsed } = useKeycloak();
  // Session/workspace changes unmount the dialog; routine access-token refreshes do not.
  if (!authenticated) return null;
  return (
    <ApiKeySection
      key={`${workspaceId}:${idTokenParsed?.sub ?? ''}`}
      workspaceId={workspaceId}
      {...links}
    />
  );
}
