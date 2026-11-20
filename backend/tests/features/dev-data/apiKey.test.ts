jest.mock('../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry', () => ({
  resolveDefaultCredentialIssuerCode: jest.fn(),
}));
jest.mock('../../../src/core/services/featureAvailabilityService', () => ({
  isFeatureAvailable: jest.fn(),
}));
// No database: the issuer gate must return before any work, and an allowed run writes through this.
jest.mock('../../../src/core/db/client', () => ({ db: { transaction: jest.fn() } }));

import { db } from '../../../src/core/db/client';
import { resolveDefaultCredentialIssuerCode } from '../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry';
import { isFeatureAvailable } from '../../../src/core/services/featureAvailabilityService';
import { createDevApiKey } from '../../../src/features/dev-data/apiKey';

beforeEach(() => jest.resetAllMocks());

describe('createDevApiKey', () => {
  it.each(['aps-credential-issuer-v3', 'another-issuer'])(
    'creates no key under %s, which never issued it',
    async (issuerCode) => {
      jest.mocked(resolveDefaultCredentialIssuerCode).mockReturnValue(issuerCode);
      await expect(createDevApiKey('run', 'workspace', 'actor')).resolves.toBeNull();
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    'records whether api-keys is available in the key workspace (%s)',
    async (available) => {
      jest.mocked(resolveDefaultCredentialIssuerCode).mockReturnValue('credential-issuer-noop');
      const tx = {
        insert: () => ({
          values: () =>
            Object.assign(Promise.resolve(), { returning: async () => [{ id: 'credential' }] }),
        }),
      };
      (db.transaction as jest.Mock).mockImplementation(async (work: (t: unknown) => unknown) =>
        work(tx),
      );
      jest.mocked(isFeatureAvailable).mockResolvedValue(available);
      await expect(createDevApiKey('run', 'workspace', 'actor')).resolves.toEqual({
        workspaceId: 'workspace',
        clientId: 'dev-data-run',
        apiKeysAvailable: available,
      });
      expect(isFeatureAvailable).toHaveBeenCalledWith('api-keys', {
        workspaceId: 'workspace',
        formId: null,
      });
    },
  );
});
