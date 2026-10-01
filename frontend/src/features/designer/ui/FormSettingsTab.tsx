'use client';

import type { Dictionary } from '@/src/types/dictionary';
import { AccordionGroup } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useForm } from '@/src/features/designer/data/useForm';
import { useFormSettingsSections } from '@/src/features/form-settings/data/sections';
import type { FormVersionSummary } from '@/src/types/forms';

interface FormSettingsTabProps {
  dict: Dictionary;
  formId: string;
  selectedVersion?: Pick<FormVersionSummary, 'id' | 'versionNo'> | null;
}

export default function FormSettingsTab({
  dict,
  formId,
  selectedVersion,
}: Readonly<FormSettingsTabProps>) {
  const defExpanded = ['form-settings'];
  // One read for the tab: the section list needs the form's workspace, and the drawers that edit
  // the form itself share this key.
  const { form, currentVersion, loading } = useForm(formId);
  const sections = useFormSettingsSections(formId, form?.workspaceId ?? null);
  const formVersion = selectedVersion === undefined ? currentVersion : selectedVersion;

  if (loading) {
    return <CenteredProgress label={dict.general.loading} />;
  }

  // A read that failed leaves nothing to edit. The page notice already says why.
  if (!form) {
    return null;
  }

  return (
    <AccordionGroup allowsMultipleExpanded={false} defaultExpandedKeys={defExpanded}>
      {sections.map(({ id, Drawer }) => (
        <Drawer
          key={id}
          drawerName={id}
          dict={dict}
          formId={formId}
          formVersionId={formVersion?.id ?? null}
          formVersionNo={formVersion?.versionNo ?? null}
        />
      ))}
    </AccordionGroup>
  );
}
