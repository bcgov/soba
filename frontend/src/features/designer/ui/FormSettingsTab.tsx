'use client';

import type { Dictionary } from '@/src/types/plugins';
import { AccordionGroup } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import FormSettingsDrawer from '@/src/features/designer/ui/FormSettingsDrawer';
import FormProfileDrawer from '@/src/features/designer/ui/FormProfileDrawer';
import { useForm } from '@/src/features/designer/useForm';

interface FormSettingsTabProps {
  dict: Dictionary;
  formId: string;
}

export default function FormSettingsTab({ dict, formId }: Readonly<FormSettingsTabProps>) {
  const defExpanded = ['form-settings'];
  // The drawers edit the loaded form, so none of them render until it is here. One read for the
  // tab: the drawers share its key.
  const { form, loading } = useForm(formId);

  if (loading) {
    return <CenteredProgress label={dict.general.loading} />;
  }

  // A read that failed leaves nothing to edit. The page notice already says why.
  if (!form) {
    return null;
  }

  return (
    <AccordionGroup allowsMultipleExpanded={false} defaultExpandedKeys={defExpanded}>
      <FormSettingsDrawer drawerName="form-settings" dict={dict} formId={formId} />
      <FormProfileDrawer drawerName="form-profile" dict={dict} formId={formId} />
    </AccordionGroup>
  );
}
