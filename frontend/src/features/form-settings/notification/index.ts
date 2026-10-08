import type { FormSettingsSection } from '../types';
import NotificationSettingsDrawer from './NotificationSettingsDrawer';
export const notificationSection: FormSettingsSection = {
  id: 'notification-settings',
  weight: 35,
  Drawer: NotificationSettingsDrawer,
};
