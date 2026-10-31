import FormApiKeyDrawer from './FormApiKeyDrawer';
import type { WorkspaceSettingsSection, FormSettingsSection } from '../types';
import WorkspaceApiKeyDrawer from './WorkspaceApiKeyDrawer';

export const workspaceApiKeySection: WorkspaceSettingsSection = {
  id: 'workspace-api-keys',
  weight: 30,
  Drawer: WorkspaceApiKeyDrawer,
};

export const formApiKeySection: FormSettingsSection = {
  id: 'form-api-keys',
  weight: 50,
  Drawer: FormApiKeyDrawer,
};
