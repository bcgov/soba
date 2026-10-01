import TemplatesDrawer from '@/src/features/templates/ui/TemplatesDrawer';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';
import type { FormSettingsSection } from '../types';

/** The document templates on the form's current version. */
export const templatesSection: FormSettingsSection = {
  id: 'document-templates',
  weight: 40,
  featureCode: FEATURE_CODES.TEMPLATES,
  Drawer: TemplatesDrawer,
};
