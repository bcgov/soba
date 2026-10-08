# Notify v1

Discovered by the plugin registry as `notify-v1`. The notification adapter is
created lazily, so an unconfigured Notify service does not prevent SOBA startup.

Configure these backend environment variables (put the API key in a Secret):

- `NOTIFICATION_DEFAULT_CODE=notify-v1` (the default)
- `PLUGIN_NOTIFY_V1_ENDPOINT`: Notify base URL including `/api/v1`
- `PLUGIN_NOTIFY_V1_API_KEY`: the SOBA API key
- `PLUGIN_NOTIFY_V1_TIMEOUT_MS`: optional outbound timeout

The adapter authenticates to Notify using only the configured `X-API-KEY`.
Backend code sends email directly through the plugin registry:

```ts
import { getNotificationAdapter } from '../../core/integrations/plugins/PluginRegistry';
import { SendEmailSchema } from '../../features/notifications/schema';

const email = SendEmailSchema.parse({
  recipients: { to: ['recipient@example.com'] },
  content: {
    subject: 'SOBA notification',
    body: 'Hello from SOBA',
  },
});
const notification = await getNotificationAdapter().sendEmail(email);
```

Optional `cc` and `bcc` arrays are supported. `bodyType` defaults to `text` and
also accepts `html`. The adapter supports inline content and returns Notify's
notification record; acceptance does not mean delivery. Sends are never retried
automatically, to avoid duplicate emails when a response is lost. Upstream
failures throw `ServiceUnavailableError` without recipient or credential details.
