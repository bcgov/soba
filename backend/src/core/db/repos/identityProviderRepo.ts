import { eq } from 'drizzle-orm';
import { db } from '../client';
import { identityProviders } from '../schema';

export interface IdentityProviderRow {
  code: string;
  name: string;
  isActive: boolean;
  isLoginProvider: boolean;
}

export const getIdentityProvider = async (code: string): Promise<IdentityProviderRow | null> => {
  const rows = await db
    .select({
      code: identityProviders.code,
      name: identityProviders.name,
      isActive: identityProviders.isActive,
      isLoginProvider: identityProviders.isLoginProvider,
    })
    .from(identityProviders)
    .where(eq(identityProviders.code, code))
    .limit(1);
  return rows[0] ?? null;
};
