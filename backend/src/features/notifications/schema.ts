import { z } from 'zod';

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

export const NotifyResponseSchema = z.object({
  notifyId: z.uuid(),
  status: z.enum(['accepted', 'pending', 'sending', 'completed', 'failed', 'cancelled']),
  channels: z.array(z.literal('email')).min(1),
  createdAt: z.iso.datetime({ offset: true }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type NotifyResponse = z.infer<typeof NotifyResponseSchema>;
