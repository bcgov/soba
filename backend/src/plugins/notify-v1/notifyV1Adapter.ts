import type { PluginConfigReader } from '../../core/config/pluginConfig';
import type { NotificationAdapter } from '../../core/integrations/notification/NotificationAdapter';
import { HttpClient, HttpClientError, HttpClientTimeoutError } from '../../core/http/httpClient';
import { ServiceUnavailableError } from '../../core/errors';
import { log } from '../../core/logging';
import {
  NotifyResponseSchema,
  type NotifyResponse,
  type SendEmail,
} from '../../features/notifications/schema';

// Only expose known transport codes; arbitrary error messages can include private data.
const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function failureMessage(err: unknown): string {
  if (err instanceof ServiceUnavailableError) return err.message;
  if (err instanceof HttpClientError)
    return `Notify email send failed (upstream HTTP ${err.status})`;
  if (err instanceof HttpClientTimeoutError)
    return `Notify email send failed (timeout; budget ${err.budgetMs}ms)`;
  if (err instanceof SyntaxError) return 'Notify returned an invalid JSON response';
  if (err instanceof Error) {
    const cause = err.cause;
    let code: unknown;
    if (typeof cause === 'object' && cause !== null && 'code' in cause) {
      code = cause.code;
    } else if ('code' in err) {
      code = err.code;
    }
    if (typeof code === 'string' && NETWORK_CODES.has(code))
      return `Notify email send failed (network ${code})`;
    if (err instanceof TypeError) return 'Notify email send failed (network or request error)';
  }
  return 'Notify email send failed';
}

/** Notify v1 email client using the configured API key. */
export class NotifyV1Adapter implements NotificationAdapter {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs?: number;
  private readonly debugResponses: boolean;

  constructor(config: PluginConfigReader) {
    // ENDPOINT includes /api/v1.
    this.endpoint = config.getRequired('ENDPOINT');
    this.apiKey = config.getRequired('API_KEY');
    this.timeoutMs = config.getOptionalNumber('TIMEOUT_MS');
    this.debugResponses = config.getOptional('DEBUG_RESPONSES') === 'true';
  }

  private client(): HttpClient {
    return new HttpClient({
      baseUrl: this.endpoint,
      defaultHeaders: { 'X-API-KEY': this.apiKey },
      timeoutMs: this.timeoutMs,
    });
  }

  async sendEmail(email: SendEmail): Promise<NotifyResponse> {
    try {
      const response = await this.client().postJsonForBinary('notifysimple/email', email);
      const body: unknown = JSON.parse(response.data.toString('utf8'));
      const parsed = NotifyResponseSchema.safeParse(body);
      if (!parsed.success) {
        if (this.debugResponses) {
          log.error(
            { upstreamBody: body, validationIssues: parsed.error.issues },
            'Notify unexpected response (debug)',
          );
        }
        throw new ServiceUnavailableError('Notify returned an unexpected response');
      }
      return parsed.data;
    } catch (err) {
      if (this.debugResponses && err instanceof HttpClientError) {
        log.error(
          {
            upstreamStatus: err.status,
            upstreamStatusText: err.statusText,
            upstreamBody: err.body,
          },
          'Notify upstream error response (debug)',
        );
      }
      // Upstream bodies can contain recipient addresses or credentials; keep them private.
      throw new ServiceUnavailableError(failureMessage(err));
    }
  }
}
