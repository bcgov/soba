import type { FormSettingsSection } from '../types';
import SubmitterSettingsDrawer from './SubmitterSettingsDrawer';

/** What the form's submitters may do. */
export const submitterSection: FormSettingsSection = {
  id: 'submitter-settings',
  weight: 30,
  Drawer: SubmitterSettingsDrawer,
};
