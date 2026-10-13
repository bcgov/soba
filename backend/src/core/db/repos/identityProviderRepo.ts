import { and, asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { identityProviders } from '../schema';
import { collated } from '../listSort';
import type { SortLocale } from '@soba/lib';

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

/** Active login-enabled providers (the assignable submitter audiences), by name. */
export const listLoginIdentityProviders = async (
  locale: SortLocale,
): Promise<{ code: string; name: string }[]> => {
  return db
    .select({ code: identityProviders.code, name: identityProviders.name })
    .from(identityProviders)
    .where(and(eq(identityProviders.isActive, true), eq(identityProviders.isLoginProvider, true)))
    .orderBy(asc(collated(identityProviders.name, locale)));
};
