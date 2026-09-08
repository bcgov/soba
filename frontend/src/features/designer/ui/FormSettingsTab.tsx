'use client';

import type { Dictionary } from '@/src/types/plugins';
import { AccordionGroup } from '@bcgov/design-system-react-components';
import FormSettingsDrawer from '@/src/features/designer/ui/FormSettingsDrawer';
import FormProfileDrawer from '@/src/features/designer/ui/FormProfileDrawer';

interface FormSettingsTabProps {
  dict: Dictionary;
  formId: string;
}

export default function FormSettingsTab({ dict, formId }: FormSettingsTabProps) {
  const defExpanded = ['form-settings'];
  return (
    <AccordionGroup allowsMultipleExpanded={false} defaultExpandedKeys={defExpanded}>
      <FormSettingsDrawer drawerName="form-settings" dict={dict} formId={formId} />
      <FormProfileDrawer drawerName="form-profile" dict={dict} formId={formId} />
    </AccordionGroup>
  );
}
