import type { NotificationType } from './slices/notificationSlice';

export const NotificationTypes: Record<string, { type: NotificationType }> = {
  INFO: { type: 'info' },
  SUCCESS: { type: 'success' },
  WARNING: { type: 'warning' },
  ERROR: { type: 'error' },
};
