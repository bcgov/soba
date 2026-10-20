# Notify v1

Discovered by the plugin registry as `notify-v1`. The notification adapter is
created lazily, so an unconfigured Notify service does not prevent SOBA startup.
`notification-noop` is the default; select this plugin with
`NOTIFICATION_DEFAULT_CODE=notify-v1`.

Configure these backend environment variables (put the API key in a Secret):

- `NOTIFICATION_DEFAULT_CODE=notify-v1`
- `PLUGIN_NOTIFY_V1_ENDPOINT`: Notify base URL including `/api/v1`
- `PLUGIN_NOTIFY_V1_API_KEY`: the SOBA API key
- `PLUGIN_NOTIFY_V1_TIMEOUT_MS`: optional outbound timeout
- `PLUGIN_NOTIFY_V1_DEBUG_RESPONSES=true`: log full upstream HTTP error response bodies
  and unexpected success responses with schema validation issues
  for local debugging. Disabled by default; bodies may contain private data.

Notify test only delivers to addresses on its safelist. Add each recipient at
https://common-notify-test.apps.silver.devops.gov.bc.ca/settings

The adapter authenticates to Notify using only the configured `X-API-KEY`.
Backend code sends email through the plugin registry:

```ts
import { getNotificationAdapter } from '../../core/integrations/plugins/PluginRegistry';

const receipt = await getNotificationAdapter().sendEmail({
  recipients: { to: ['recipient@example.com'] },
  content: {
    subject: 'SOBA notification',
    body: 'Hello from SOBA',
    bodyType: 'text',
  },
});
```

The request is checked against `SendEmailSchema`. Optional `cc` and `bcc` arrays
are supported. `bodyType` is `text` or `html`. The receipt's `id` is Notify's
`notifyId` and `status` is Notify's status; acceptance does not mean delivery. Sends are never retried
automatically, to avoid duplicate emails when a response is lost. Upstream
failures throw `ServiceUnavailableError` without recipient or credential details.
