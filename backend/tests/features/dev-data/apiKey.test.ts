jest.mock('../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry', () => ({
  resolveDefaultCredentialIssuerCode: jest.fn(),
}));
// A tripwire, not a stand-in: the gate must return before any database work.
jest.mock('../../../src/core/db/client', () => ({ db: { transaction: jest.fn() } }));

import { db } from '../../../src/core/db/client';
import { resolveDefaultCredentialIssuerCode } from '../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry';
import { createDevApiKey } from '../../../src/features/dev-data/apiKey';

describe('createDevApiKey', () => {
  it.each(['aps-credential-issuer-v3', 'another-issuer'])(
    'creates no key under %s, which never issued it',
    async (issuerCode) => {
      jest.mocked(resolveDefaultCredentialIssuerCode).mockReturnValue(issuerCode);
      await expect(createDevApiKey('run', 'workspace', 'actor')).resolves.toBeNull();
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );
});
