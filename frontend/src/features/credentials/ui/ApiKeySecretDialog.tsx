'use client';

import { useId, useState } from 'react';
import { Button } from '@bcgov/design-system-react-components';
import { Modal } from '@/src/components/Modal';
import type { Dictionary } from '@/src/types/dictionary';
import type { CredentialSecret } from '@/src/types/credentials';
import styles from './ApiKeySecretDialog.module.css';

export function ApiKeySecretDialog({
  dict,
  secret,
  onDone,
}: Readonly<{
  dict: Dictionary;
  secret: CredentialSecret;
  onDone: () => void;
}>) {
  const t = dict.apiKeys;
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret.apiKey);
      setCopied(true);
      setError('');
    } catch {
      setError(t.copyError);
    }
  };
  return (
    <Modal
      show
      title={t.generate}
      size="md"
      onClose={onDone}
      footer={
        <Button variant="primary" data-testid="api-key-done" onPress={onDone}>
          {t.done}
        </Button>
      }
    >
      <div className={styles.warning} role="note" data-testid="api-key-once-warning">
        <strong>{t.onceTitle}</strong>
        <p>{t.onceBody}</p>
      </div>
      <p>{secret.credential.label}</p>
      <label htmlFor={id}>{t.yourKey}</label>
      <input
        id={id}
        data-testid="api-key-secret"
        className={styles.key}
        value={secret.apiKey}
        readOnly
        autoComplete="off"
        spellCheck={false}
      />
      <Button variant="secondary" data-testid="api-key-copy" onPress={() => void copy()}>
        {t.copy}
      </Button>
      {copied && (
        <p role="status" data-testid="api-key-copied">
          {t.copied}
        </p>
      )}
      {error && (
        <p role="alert" data-testid="api-key-copy-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
