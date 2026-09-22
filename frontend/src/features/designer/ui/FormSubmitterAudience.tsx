'use client';
import { useId, useMemo, useRef, useState } from 'react';
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
import { loadErrorMessage } from '@/src/shared/api/loadErrorMessage';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import type { SetFormSubmitterAudienceBody } from '@/src/types/groups';
import { useSubmitterAudience, type AudienceView } from '../data/useSubmitterAudience';
import styles from './FormSubmitterAudience.module.css';

type Props = Readonly<{
  workspaceId: string | null;
  /** Shows and edits this form's audience, which can inherit the workspace's. */
  formId?: string;
  canManage: boolean;
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

export function FormSubmitterAudience({ workspaceId, formId, canManage }: Props) {
  const dict = useDictionary();
  const t = dict.form;
  const { token } = useKeycloak();
  const [mode, setMode] = useState('');
  const [idps, setIdps] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const summaryId = useId();
  const isForm = !!formId;

  const { view: audience, error: loadError, save } = useSubmitterAudience(workspaceId, formId);

  // Reading the audience needs a permission the form's designer need not hold, so the no-access
  // branch is a normal outcome here rather than a misconfiguration.
  const readError = useMemo(
    () =>
      loadError
        ? loadErrorMessage(loadError, {
            sessionExpired: dict.general.sessionExpired,
            noAccess: dict.general.noAccess,
            failed: t.submitterAudienceLoadError,
          })
        : null,
    [loadError, dict.general.sessionExpired, dict.general.noAccess, t.submitterAudienceLoadError],
  );

  // Seed the editable state from the saved audience whenever the panel opens. An inherited
  // protected audience seeds its providers, so an override starts from the workspace's.
  const openPanel = () => {
    if (!audience) return;
    setMode(initialMode(audience));
    // A saved provider that is no longer offered has no checkbox to untick, so it is left out.
    const offered = new Set(audience.available.map((p) => p.code));
    setIdps(audience.mode === 'protected' ? audience.idps.filter((c) => offered.has(c)) : []);
    setSaveError(null);
    setOpen(true);
  };

  const summary = useMemo(() => {
    if (!audience) return '…';
    const text = describeAudience(audience, audience.available, t);
    return audience.inherit ? t.submitterAudienceInheritedSummary.replace('{summary}', text) : text;
  }, [audience, t]);

  const workspaceSummary =
    audience?.workspace && describeAudience(audience.workspace, audience.available, t);

  // Protected needs a principal. A workspace's existing direct user counts; a form override holds
  // providers only.
  const directUsers = isForm ? 0 : (audience?.users.length ?? 0);
  const noPrincipal = mode === 'protected' && idps.length === 0 && directUsers === 0;
  const saveDisabled = saving || mode === '' || noPrincipal;
  const overridesPeople =
    (mode === 'public' || mode === 'protected') && (audience?.workspace?.users.length ?? 0) > 0;

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    try {
      await save(token, saveBody(mode, idps));
      setOpen(false);
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
            variant="secondary"
            isDisabled={!canManage || !audience}
            onPress={openPanel}
            data-testid="submitter-audience-trigger"
          >
            {summary}
          </Button>
        </span>
      )}
      <Popover
        triggerRef={triggerRef}
        isOpen={open}
        onOpenChange={setOpen}
        className={styles.panel}
      >
        <Dialog aria-label={t.submitterAudienceLabel} className={styles.dialog}>
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
        </Dialog>
      </Popover>
    </div>
  );
}
