import type { FormSettingsSection } from '../types';
import NotificationSettingsDrawer from './NotificationSettingsDrawer';

/** Who is emailed when the form receives a submission. */
export const notificationSection: FormSettingsSection = {
  id: 'notification-settings',
  weight: 35,
  Drawer: NotificationSettingsDrawer,
};
