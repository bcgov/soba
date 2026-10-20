import { z } from 'zod';
import type { PluginConfigReader } from '../../config/pluginConfig';

const addresses = z.array(z.email()).max(100);

export const SendEmailSchema = z.strictObject({
  recipients: z.strictObject({
    to: addresses.min(1),
    cc: addresses.optional(),
    bcc: addresses.optional(),
  }),
  content: z.strictObject({
    subject: z.string().trim().min(1).max(998),
    body: z.string().min(1).max(100_000),
    bodyType: z.enum(['text', 'html']).default('text'),
  }),
});
export type SendEmail = z.infer<typeof SendEmailSchema>;

/** What the provider answered for an accepted email. Accepted is not delivered. */
export interface EmailReceipt {
  /** The provider's id for the message; null when nothing was sent. */
  id: string | null;
  status: string;
}

export interface NotificationAdapter {
  sendEmail(email: SendEmail): Promise<EmailReceipt>;
}

export interface NotificationPluginDefinition {
  code: string;
  metadata: { code: string; name: string; version?: string };
  createAdapter: (config: PluginConfigReader) => NotificationAdapter;
}
