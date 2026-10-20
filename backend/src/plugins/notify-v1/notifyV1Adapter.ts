import { z } from 'zod';
import type { PluginConfigReader } from '../../core/config/pluginConfig';
import {
  SendEmailSchema,
  type EmailReceipt,
  type NotificationAdapter,
  type SendEmail,
} from '../../core/integrations/notification/NotificationAdapter';
import { HttpClient, HttpClientError, HttpClientTimeoutError } from '../../core/http/httpClient';
import { ServiceUnavailableError, ValidationError } from '../../core/errors';
import { log } from '../../core/logging';

const EMAIL_PATH = 'notifysimple/email';

// Notify adds statuses over time, so any status is accepted.
const NotifyAcceptanceSchema = z.object({
  notifyId: z.string().min(1),
  status: z.string().min(1),
});

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
  private readonly http: HttpClient;
  private readonly debugResponses: boolean;

  constructor(config: PluginConfigReader) {
    this.http = new HttpClient({
      // ENDPOINT includes /api/v1.
      baseUrl: config.getRequired('ENDPOINT'),
      defaultHeaders: { 'X-API-KEY': config.getRequired('API_KEY') },
      timeoutMs: config.getOptionalNumber('TIMEOUT_MS'),
    });
    this.debugResponses = config.getOptional('DEBUG_RESPONSES') === 'true';
  }

  async sendEmail(email: SendEmail): Promise<EmailReceipt> {
    const request = SendEmailSchema.safeParse(email);
    // The issues name the invalid addresses, so they stay out of the error.
    if (!request.success) throw new ValidationError('Notify email request is not valid');
    try {
      const response = await this.http.postJsonForBinary(EMAIL_PATH, request.data);
      return this.receipt(JSON.parse(response.data.toString('utf8')));
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

  private receipt(body: unknown): EmailReceipt {
    const parsed = NotifyAcceptanceSchema.safeParse(body);
    if (!parsed.success) {
      if (this.debugResponses) {
        log.error(
          { upstreamBody: body, validationIssues: parsed.error.issues },
          'Notify unexpected response (debug)',
        );
      }
      throw new ServiceUnavailableError('Notify returned an unexpected response');
    }
    return { id: parsed.data.notifyId, status: parsed.data.status };
  }
}
