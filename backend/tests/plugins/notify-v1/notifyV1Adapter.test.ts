import { HttpClientTimeoutError } from '../../../src/core/http/httpClient';
import { NotifyV1Adapter } from '../../../src/plugins/notify-v1/notifyV1Adapter';
import { createPluginConfigReaderFrom } from '../../../src/core/config/pluginConfig';
import { createEnvReader } from '../../../src/core/config/env';
import { SendEmailSchema } from '../../../src/features/notifications/schema';

const email = SendEmailSchema.parse({
  recipients: { to: ['recipient@example.com'] },
  content: { subject: 'Hello', body: 'SOBA message' },
});
const result = {
  notifyId: 'b4fe3ccc-b989-4a36-82f5-b512f5eb156a',
  status: 'accepted',
  channel: 'email',
  createdAt: '2026-10-05T12:00:00Z',
};
const makeAdapter = () =>
  new NotifyV1Adapter(
    createPluginConfigReaderFrom(
      createEnvReader({
        PLUGIN_NOTIFY_V1_ENDPOINT: 'https://notify.example/api/v1',
        PLUGIN_NOTIFY_V1_API_KEY: 'configured-key',
      }),
      'notify-v1',
    ),
  );

afterEach(() => jest.restoreAllMocks());

test('sends inline email with only the configured API key', async () => {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(result)));
  await expect(makeAdapter().sendEmail(email)).resolves.toEqual(result);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    'https://notify.example/api/v1/notifysimple/email',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(email),
      headers: expect.objectContaining({
        'X-API-KEY': 'configured-key',
      }),
    }),
  );
  expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
});

test('does not retry an ambiguous failure or expose upstream content', async () => {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response('secret upstream body', { status: 500 }));
  await expect(makeAdapter().sendEmail(email)).rejects.toThrow(
    'Notify email send failed (upstream HTTP 500)',
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('rejects malformed upstream success', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'));
  await expect(makeAdapter().sendEmail(email)).rejects.toThrow('unexpected response');
});

test('rejects invalid recipients and caller supplied tenant overrides', () => {
  expect(SendEmailSchema.safeParse({ ...email, recipients: { to: ['invalid'] } }).success).toBe(
    false,
  );
  expect(SendEmailSchema.safeParse({ ...email, cstarTenantId: 'other' }).success).toBe(false);
});

test.each([401, 403, 404, 429, 502])(
  'reports upstream HTTP %s without exposing the response',
  async (status) => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('configured-key recipient@example.com', { status }));
    await expect(makeAdapter().sendEmail(email)).rejects.toThrow(
      new Error(`Notify email send failed (upstream HTTP ${status})`),
    );
  },
);

test('reports a network cause without exposing its message', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(
    new TypeError('configured-key', {
      cause: Object.assign(new Error('recipient@example.com'), { code: 'ENOTFOUND' }),
    }),
  );
  await expect(makeAdapter().sendEmail(email)).rejects.toThrow(
    new Error('Notify email send failed (network ENOTFOUND)'),
  );
});

test('reports timeouts without exposing the request URL', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new HttpClientTimeoutError('https://private.example', 100, 30000));
  await expect(makeAdapter().sendEmail(email)).rejects.toThrow(
    new Error('Notify email send failed (timeout; budget 30000ms)'),
  );
});

test('identifies invalid JSON without exposing response content', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response('configured-key'));
  await expect(makeAdapter().sendEmail(email)).rejects.toThrow(
    new Error('Notify returned an invalid JSON response'),
  );
});
