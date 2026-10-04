import type { FormSettingsSection } from '../types';
import FormAudienceDrawer from './FormAudienceDrawer';

/** Who can submit the form: the workspace's audience, or the form's own. */
export const audienceSection: FormSettingsSection = {
  id: 'form-audience',
  weight: 25,
  Drawer: FormAudienceDrawer,
};
