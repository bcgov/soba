import type { PluginConfigReader } from '../../config/pluginConfig';
import type { SendEmail, NotifyResponse } from '../../../features/notifications/schema';

export interface NotificationAdapter {
  sendEmail(email: SendEmail): Promise<NotifyResponse>;
}

export interface NotificationPluginDefinition {
  code: string;
  metadata: { code: string; name: string; version?: string };
  createAdapter: (config: PluginConfigReader) => NotificationAdapter;
}
