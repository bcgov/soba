import { useId } from 'react';
import {
  RadioGroup,
  Radio,
  CheckboxGroup,
  Checkbox,
  InlineAlert,
} from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import type { AudienceView } from '../data/useSubmitterAudience';

export function describeAudience(
  audience: Pick<AudienceView, 'mode' | 'idps' | 'users'>,
  available: AudienceView['available'],
  t: ReturnType<typeof useDictionary>['form'],
): string {
  if (audience.mode === 'public') return t.submitterAudiencePublic;
  if (audience.mode === 'none') return t.submitterAudienceNotSet;
  const names = audience.idps.map((c) => available.find((p) => p.code === c)?.name ?? c);
  if (audience.users.length) names.push(`${audience.users.length} ${t.submitterAudiencePeople}`);
  return `${t.submitterAudienceProtected} (${names.join(', ')})`;
}

export interface SubmitterAudienceControlsProps {
  mode: string;
  setMode: (mode: string) => void;
  idps: string[];
  setIdps: (idps: string[]) => void;
  saving?: boolean;
  isForm?: boolean;
  effectiveAudience: AudienceView | null;
  isDisabled?: boolean;
}

export function SubmitterAudienceControls({
  mode,
  setMode,
  idps,
  setIdps,
  saving = false,
  isForm = false,
  effectiveAudience,
  isDisabled = false,
}: SubmitterAudienceControlsProps) {
  const dict = useDictionary();
  const t = dict.form;
  const summaryId = useId();

  const workspaceSummary =
    effectiveAudience?.workspace &&
    describeAudience(effectiveAudience.workspace, effectiveAudience.available, t);

  const overridesPeople =
    (mode === 'public' || mode === 'protected') &&
    (effectiveAudience?.workspace?.users.length ?? 0) > 0;

  return (
    <>
      <RadioGroup
        value={mode}
        onChange={setMode}
        isDisabled={saving || isDisabled}
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
          isDisabled={saving || isDisabled}
          label={t.submitterAudienceProviders}
        >
          {(effectiveAudience?.available ?? []).map((p) => (
            <Checkbox key={p.code} value={p.code} data-testid={`audience-idp-${p.code}`}>
              {p.name}
            </Checkbox>
          ))}
        </CheckboxGroup>
      )}
    </>
  );
}
