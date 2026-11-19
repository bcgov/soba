import { env, type NotificationSettings } from '../../config/env';

let settings: NotificationSettings | undefined;

/** Notification settings, read once per process. Throws when a set value is not valid. */
export const getNotificationSettings = (): NotificationSettings => {
  settings ??= env.getNotificationSettings();
  return settings;
};
