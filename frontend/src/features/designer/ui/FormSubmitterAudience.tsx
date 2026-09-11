'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover, Dialog } from 'react-aria-components';
import {
  Button,
  RadioGroup,
  Radio,
  CheckboxGroup,
  Checkbox,
  InlineAlert,
} from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { getSubmitterAudience, setSubmitterAudience } from '@/src/shared/api/sobaApiGroups';
import type { SubmitterAudience } from '@/src/types/groups';
import styles from './FormSubmitterAudience.module.css';

type Props = Readonly<{
  workspaceId: string | null;
  token?: string;
  canManage: boolean;
}>;

export function FormSubmitterAudience({ workspaceId, token, canManage }: Props) {
  const t = useDictionary().form;
  const [audience, setAudience] = useState<SubmitterAudience | null>(null);
  const [mode, setMode] = useState('');
  const [idps, setIdps] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  // Dedupe StrictMode's dev double-invoke; re-fetch only when the active workspace changes.
  const fetchedWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !token) return;
    const ws = workspaceId;
    if (fetchedWorkspaceRef.current === ws) return;
    fetchedWorkspaceRef.current = ws;
    getSubmitterAudience(token, ws)
      // Ignore a superseded response if the active workspace changed while this was in flight.
      .then((a) => fetchedWorkspaceRef.current === ws && setAudience(a))
      .catch(() => fetchedWorkspaceRef.current === ws && setError(t.submitterAudienceLoadError));
  }, [workspaceId, token, t.submitterAudienceLoadError]);

  // Seed the editable state from the saved audience whenever the panel opens.
  const openPanel = () => {
    if (!audience) return;
    setMode(audience.mode === 'none' ? '' : audience.mode);
    setIdps(audience.mode === 'protected' ? audience.idps : []);
    setError(null);
    setOpen(true);
  };

  const summary = useMemo(() => {
    if (!audience) return '…';
    if (audience.mode === 'public') return t.submitterAudiencePublic;
    if (audience.mode === 'none') return t.submitterAudienceNotSet;
    const names = audience.idps.map((c) => audience.available.find((p) => p.code === c)?.name ?? c);
    if (audience.users.length) names.push(`${audience.users.length} ${t.submitterAudiencePeople}`);
    return `${t.submitterAudienceProtected} (${names.join(', ')})`;
  }, [audience, t]);

  // Protected needs a principal; an existing direct user counts even with no idps selected.
  const noPrincipal =
    mode === 'protected' && idps.length === 0 && (audience?.users.length ?? 0) === 0;
  const saveDisabled = saving || mode === '' || noPrincipal;

  const onSave = async () => {
    if (!workspaceId || !token) return;
    setSaving(true);
    setError(null);
    try {
      const body =
        mode === 'public' ? ({ mode: 'public' } as const) : ({ mode: 'protected', idps } as const);
      setAudience(await setSubmitterAudience(token, workspaceId, body));
      setOpen(false);
    } catch {
      setError(t.submitterAudienceSaveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>{t.submitterAudienceLabel}</span>
      <span ref={triggerRef} className={styles.triggerWrap}>
        <Button
          variant="secondary"
          isDisabled={!canManage || !audience}
          onPress={openPanel}
          data-testid="submitter-audience-trigger"
        >
          {summary}
        </Button>
      </span>
      <Popover
        triggerRef={triggerRef}
        isOpen={open}
        onOpenChange={setOpen}
        className={styles.panel}
      >
        <Dialog aria-label={t.submitterAudienceLabel} className={styles.dialog}>
          <div className={styles.sections}>
            {error && <InlineAlert variant="danger" title={error} />}
            <RadioGroup value={mode} onChange={setMode} label={t.submitterAudienceLabel}>
              <Radio value="public" data-testid="audience-mode-public">
                {t.submitterAudiencePublic}
              </Radio>
              <Radio value="protected" data-testid="audience-mode-protected">
                {t.submitterAudienceProtected}
              </Radio>
            </RadioGroup>
            {mode === 'protected' && (
              <CheckboxGroup value={idps} onChange={setIdps} label={t.submitterAudienceProviders}>
                {(audience?.available ?? []).map((p) => (
                  <Checkbox key={p.code} value={p.code} data-testid={`audience-idp-${p.code}`}>
                    {p.name}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            )}
            <div className={styles.actions}>
              <Button
                variant="tertiary"
                onPress={() => setOpen(false)}
                data-testid="audience-cancel"
              >
                {t.submitterAudienceCancel}
              </Button>
              <Button onPress={onSave} isDisabled={saveDisabled} data-testid="audience-save">
                {t.submitterAudienceSave}
              </Button>
            </div>
          </div>
        </Dialog>
      </Popover>
    </div>
  );
}
