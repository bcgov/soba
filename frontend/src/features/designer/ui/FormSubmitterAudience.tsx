'use client';
import { useId, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import {
  Button,
  RadioGroup,
  Radio,
  CheckboxGroup,
  Checkbox,
  InlineAlert,
} from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { messageForDataError } from '@/src/shared/api/dataError';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import type { SetFormSubmitterAudienceBody } from '@/src/types/groups';
import { useSubmitterAudience, type AudienceView } from '../data/useSubmitterAudience';
import styles from './FormSubmitterAudience.module.css';

type Props = Readonly<{
  workspaceId: string | null;
  /** Shows and edits this form's audience, which can inherit the workspace's. */
  formId?: string;
  canManage: boolean;
  createForm?: boolean;
  value?: SetFormSubmitterAudienceBody;
  onChange?: (value: SetFormSubmitterAudienceBody) => void;
}>;

type FormDict = ReturnType<typeof useDictionary>['form'];

function describeAudience(
  audience: Pick<AudienceView, 'mode' | 'idps' | 'users'>,
  available: AudienceView['available'],
  t: FormDict,
): string {
  if (audience.mode === 'public') return t.submitterAudiencePublic;
  if (audience.mode === 'none') return t.submitterAudienceNotSet;
  const names = audience.idps.map((c) => available.find((p) => p.code === c)?.name ?? c);
  if (audience.users.length) names.push(`${audience.users.length} ${t.submitterAudiencePeople}`);
  return `${t.submitterAudienceProtected} (${names.join(', ')})`;
}

function initialMode(audience: AudienceView): string {
  if (audience.inherit) return 'inherit';
  return audience.mode === 'none' ? '' : audience.mode;
}

function saveBody(mode: string, idps: string[]): SetFormSubmitterAudienceBody {
  if (mode === 'inherit') return { mode: 'inherit' };
  if (mode === 'public') return { mode: 'public' };
  return { mode: 'protected', idps };
}

export function FormSubmitterAudience({
  workspaceId,
  formId,
  canManage,
  createForm,
  value,
  onChange,
}: Props) {
  const dict = useDictionary();
  const t = dict.form;
  const { token } = useKeycloak();
  const [mode, setMode] = useState('');
  const [idps, setIdps] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const summaryId = useId();
  const isForm = !!formId || !!createForm;

  const { view: audience, error: loadError, save } = useSubmitterAudience(workspaceId, formId);

  // Reading the audience needs a permission the form's designer need not hold, so the no-access
  // branch is a normal outcome here rather than a misconfiguration.
  const readError = useMemo(
    () =>
      loadError
        ? messageForDataError(loadError, {
            sessionExpired: dict.general.sessionExpired,
            forbidden: dict.general.noAccess,
            failed: t.submitterAudienceLoadError,
          })
        : null,
    [loadError, dict.general.sessionExpired, dict.general.noAccess, t.submitterAudienceLoadError],
  );

  const effectiveAudience = useMemo(() => {
    if (!audience) return null;
    const ws = audience.workspace ?? {
      mode: audience.mode,
      idps: audience.idps,
      users: audience.users,
    };
    if (value) {
      const alternateIdps = value.mode === 'inherit' ? ws.idps : [];
      const idps = value.mode === 'protected' ? value.idps : alternateIdps;
      return {
        ...audience,
        inherit: value.mode === 'inherit',
        mode: value.mode === 'inherit' ? ws.mode : value.mode,
        idps: idps,
        users: value.mode === 'inherit' ? ws.users : [],
        workspace: ws,
      };
    }
    return { ...audience, workspace: ws };
  }, [audience, value]);

  // Seed the editable state from the saved audience whenever the panel opens. An inherited
  // protected audience seeds its providers, so an override starts from the workspace's.
  const openPanel = () => {
    if (!effectiveAudience) return;
    if (value) {
      setMode(value.mode);
      const offered = new Set(effectiveAudience.available.map((p) => p.code));
      const alternateIdps =
        effectiveAudience.mode === 'protected'
          ? effectiveAudience.idps.filter((c) => offered.has(c))
          : [];
      const idps = value.mode === 'protected' ? value.idps : alternateIdps;
      setIdps(idps);
    } else {
      setMode(initialMode(effectiveAudience));
      const offered = new Set(effectiveAudience.available.map((p) => p.code));
      setIdps(
        effectiveAudience.mode === 'protected'
          ? effectiveAudience.idps.filter((c) => offered.has(c))
          : [],
      );
    }
    setSaveError(null);
    setOpen(true);
  };

  const closePanel = () => {
    setOpen(false);
  };

  

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 8, left: rect.left });
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      
      // If the clicked node is no longer in the document, it was probably a temporary
      // element removed immediately upon click (like a ripple span).
      if (!document.contains(target)) {
        return;
      }

      if (
        open &&
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        // setOpen(false); // TEMPORARILY DISABLED
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);


  const summary = useMemo(() => {
    if (!effectiveAudience) return '…';
    const text = describeAudience(effectiveAudience, effectiveAudience.available, t);
    return effectiveAudience.inherit
      ? t.submitterAudienceInheritedSummary.replace('{summary}', text)
      : text;
  }, [effectiveAudience, t]);

  const workspaceSummary =
    effectiveAudience?.workspace &&
    describeAudience(effectiveAudience.workspace, effectiveAudience.available, t);

  // Protected needs a principal. A workspace's existing direct user counts; a form override holds
  // providers only.
  const directUsers = isForm ? 0 : (effectiveAudience?.users.length ?? 0);
  const noPrincipal = mode === 'protected' && idps.length === 0 && directUsers === 0;
  const saveDisabled = saving || mode === '' || noPrincipal;
  const overridesPeople =
    (mode === 'public' || mode === 'protected') &&
    (effectiveAudience?.workspace?.users.length ?? 0) > 0;

  const onSave = async () => {
    if (onChange) {
      onChange(saveBody(mode, idps));
      closePanel();
      return;
    }
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    try {
      await save(token, saveBody(mode, idps));
      closePanel();
    } catch {
      setSaveError(t.submitterAudienceSaveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>{t.submitterAudienceLabel}</span>
      {readError ? (
        // The control cannot open without an audience, so a refusal would otherwise show as a
        // disabled button with no reason given.
        <InlineAlert variant="warning" data-testid="submitter-audience-error" title={readError} />
      ) : (
        <span ref={triggerRef} className={styles.triggerWrap}>
          <Button
            type="button"
            variant="secondary"
            isDisabled={!canManage || !effectiveAudience}
            onPress={() => (open ? closePanel() : openPanel())}
            data-testid="submitter-audience-trigger"
          >
            {summary}
          </Button>
        </span>
      )}
      {open && (
        <div 
          ref={popoverRef} 
          className={styles.panel}
          style={{ top: position.top, left: position.left }}
        >
          <div className={styles.dialog}>
            <div className={styles.sections}>
              {saveError && <InlineAlert variant="danger" title={saveError} />}
              <RadioGroup
                value={mode}
                onChange={setMode}
                isDisabled={saving}
                label={t.submitterAudienceLabel}
              >
                {isForm && (
                  <Radio
                    value="inherit"
                    data-testid="audience-mode-inherit"
                    aria-describedby={mode === 'inherit' && workspaceSummary ? summaryId : undefined}
                  >
                    {t.submitterAudienceInherit}
                  </Radio>
                )}
                <Radio value="public" data-testid="audience-mode-public">
                  {t.submitterAudiencePublic}
                </Radio>
                <Radio value="protected" data-testid="audience-mode-protected">
                  {t.submitterAudienceProtected}
                </Radio>
              </RadioGroup>
              {mode === 'inherit' && workspaceSummary && (
                <span id={summaryId} data-testid="audience-workspace-summary">
                  {workspaceSummary}
                </span>
              )}
              {overridesPeople && (
                <InlineAlert
                  variant="info"
                  data-testid="audience-people-note"
                  title={t.submitterAudienceUsersNotApplied}
                />
              )}
              {mode === 'protected' && (
                <CheckboxGroup
                  value={idps}
                  onChange={setIdps}
                  isDisabled={saving}
                  label={t.submitterAudienceProviders}
                >
                  {(effectiveAudience?.available ?? []).map((p) => (
                    <Checkbox key={p.code} value={p.code} data-testid={`audience-idp-${p.code}`}>
                      {p.name}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              )}
              <div className={styles.actions}>
                <Button
                  variant="tertiary"
                  onPress={closePanel}
                  isDisabled={saving}
                  data-testid="audience-cancel"
                >
                  {t.submitterAudienceCancel}
                </Button>
                <Button onPress={onSave} isDisabled={saveDisabled} data-testid="audience-save">
                  {t.submitterAudienceSave}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
