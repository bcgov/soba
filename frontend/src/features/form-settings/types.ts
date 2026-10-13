import type { ComponentType } from 'react';
import type { Dictionary } from '@/src/types/dictionary';

export type FormSettingsSectionProps = Readonly<{
  dict: Dictionary;
  drawerName: string;
  formId: string;
}>;

/** One section of a form's Settings tab. */
export type FormSettingsSection = {
  /** Accordion key and test id prefix. */
  id: string;
  /** Display order; lower first. */
  weight: number;
  /** When set, the section shows only where the feature is available. */
  featureCode?: string;
  /** A scoped feature is granted per workspace or form, so the server answers for this form. */
  scoped?: boolean;
  Drawer: ComponentType<FormSettingsSectionProps>;
};
