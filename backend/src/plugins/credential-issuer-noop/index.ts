import type { CredentialIssuerPluginDefinition } from '../../core/integrations/credential-issuer/CredentialIssuerPluginDefinition';
import { ServiceUnavailableError } from '../../core/errors';

const unavailable = (): Promise<never> =>
  Promise.reject(new ServiceUnavailableError('Credential issuance is unavailable'));

export const credentialIssuerPluginDefinition: CredentialIssuerPluginDefinition = {
  code: 'credential-issuer-noop',
  metadata: { code: 'credential-issuer-noop', name: 'No-op credential issuer' },
  createAdapter: () => ({
    issue: unavailable,
    regenerate: unavailable,
    readinessCheck: () =>
      Promise.resolve({ ok: false, message: 'Credential issuance is unavailable' }),
  }),
};
