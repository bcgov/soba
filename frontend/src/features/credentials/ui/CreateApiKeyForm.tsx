'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Form,
  Heading,
  InlineAlert,
  TextField,
} from '@bcgov/design-system-react-components';
import { CreateCredentialSchema, type CredentialType } from '@soba/lib';
import type { Dictionary } from '@/src/types/dictionary';
import { isForbidden, isSessionExpired } from '@/src/shared/api/dataError';
import type { CreateCredential, CredentialSecret } from '@/src/types/credentials';

export function CreateApiKeyForm({
  dict,
  generate,
  onCreated,
  onCancel,
}: Readonly<{
  dict: Dictionary;
  generate: (input: CreateCredential) => Promise<CredentialSecret>;
  onCreated: (result: CredentialSecret) => void;
  onCancel: () => void;
}>) {
  const t = dict.apiKeys;
  const section = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [types, setTypes] = useState<CredentialType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    section.current?.focus({ preventScroll: true });
    section.current?.scrollIntoView?.({ block: 'start' });
    return () => {
      mounted.current = false;
    };
  }, []);
  const input = CreateCredentialSchema.safeParse({ label, notes, types });
  const save = async () => {
    if (inFlight.current || !input.success) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await generate(input.data);
      if (mounted.current) onCreated(result);
    } catch (err) {
      let message = t.actionError;
      if (isForbidden(err)) message = t.forbidden;
      if (isSessionExpired(err)) message = t.sessionExpired;
      if (mounted.current) setError(message);
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-label={t.add}
      data-testid="api-key-create-section"
      className="mt-4 pt-3 border-top"
    >
      <Heading level={3}>{t.add}</Heading>
      <Form
        className="d-flex flex-column gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          label={t.label}
          value={label}
          onChange={setLabel}
          maxLength={100}
          isRequired
          isDisabled={saving}
          data-testid="api-key-label"
        />
        <TextField
          label={t.notes}
          value={notes}
          onChange={setNotes}
          maxLength={1000}
          isDisabled={saving}
          data-testid="api-key-notes"
        />
        <CheckboxGroup
          label={t.types}
          description={t.typesHelp}
          value={types}
          onChange={(values) => setTypes(values as CredentialType[])}
          isRequired
          isDisabled={saving}
        >
          <Checkbox value="api" data-testid="api-key-type-api">
            {t.apiAccess}
          </Checkbox>
          <Checkbox value="web-component" data-testid="api-key-type-web-component">
            {t.webComponents}
          </Checkbox>
        </CheckboxGroup>
        {error && (
          <InlineAlert variant="danger" data-testid="api-key-create-error">
            {error}
          </InlineAlert>
        )}
        <div className="d-flex gap-3">
          <Button
            type="submit"
            variant="primary"
            isDisabled={saving || !input.success}
            data-testid="api-key-generate"
          >
            {saving ? t.working : t.generate}
          </Button>
          <Button
            type="button"
            variant="secondary"
            isDisabled={saving}
            onPress={onCancel}
            data-testid="api-key-cancel"
          >
            {dict.general.cancel}
          </Button>
        </div>
      </Form>
    </section>
  );
}
