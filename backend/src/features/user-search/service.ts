import {
  USER_SEARCH_FIELDS,
  type SortLocale,
  type UserSearchCapabilitiesResponse,
  type UserSearchField,
  type UserSearchPluginStatus,
  type UserSearchQuery,
  type UserSearchResponse,
} from '@soba/lib';
import { ServiceUnavailableError, ValidationError } from '../../core/errors';
import { log } from '../../core/logging';
import { listLoginIdentityProviders } from '../../core/db/repos/identityProviderRepo';
import { findIdentityOwners } from '../../core/db/repos/identityLookup';
import {
  createUserSearchAdapter,
  getEnabledUserSearchPluginCodes,
} from '../../core/integrations/user-search/UserSearchRegistry';
import type {
  UserSearchCapability,
  UserSearchAdapter,
} from '../../core/integrations/user-search/UserSearchAdapter';
import { displayNameOf, identityKey, mergeHits, orderUsers, type PluginHits } from './merge';

/** Most hits taken from each plugin. */
export const PLUGIN_LIMIT = 25;
/** Most people one search returns. */
export const RESULT_LIMIT = 50;

/** Narrows search on one surface. Unset allows every active login provider. */
export interface UserSearchPolicy {
  identityProviders?: readonly string[];
}

interface LoadedPlugin {
  code: string;
  adapter: UserSearchAdapter;
  capabilities: readonly UserSearchCapability[];
}

interface LoadedPlugins {
  loaded: LoadedPlugin[];
  /** Enabled codes that could not be built or could not report capabilities. */
  failed: string[];
}

const errorName = (err: unknown): string => (err instanceof Error ? err.name : 'UnknownError');

async function loadPlugins(): Promise<LoadedPlugins> {
  const codes = getEnabledUserSearchPluginCodes();
  const outcomes = await Promise.allSettled(
    codes.map(async (code) => {
      const adapter = createUserSearchAdapter(code);
      return { code, adapter, capabilities: await adapter.capabilities() };
    }),
  );
  const result: LoadedPlugins = { loaded: [], failed: [] };
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      result.loaded.push(outcome.value);
      return;
    }
    log.warn(
      { plugin: codes[index], failureType: errorName(outcome.reason) },
      'User search plugin could not load',
    );
    result.failed.push(codes[index]);
  });
  return result;
}

const accepts = (
  capabilities: readonly UserSearchCapability[],
  identityProvider: string,
  fields: readonly UserSearchField[],
): boolean =>
  capabilities.some(
    (capability) =>
      capability.identityProvider === identityProvider &&
      fields.every((field) => capability.fields.includes(field)),
  );

/** Active login providers the policy allows, by name. */
async function allowedIdentityProviders(policy: UserSearchPolicy, locale: SortLocale) {
  const identityProviders = await listLoginIdentityProviders(locale);
  const allowed = policy.identityProviders;
  return allowed
    ? identityProviders.filter(({ code }) => allowed.includes(code))
    : identityProviders;
}

/** The identity providers searchable here, each with the filters some enabled plugin accepts. */
export async function getUserSearchCapabilities(
  policy: UserSearchPolicy,
  locale: SortLocale,
): Promise<UserSearchCapabilitiesResponse> {
  const [identityProviders, { loaded }] = await Promise.all([
    allowedIdentityProviders(policy, locale),
    loadPlugins(),
  ]);
  return {
    identityProviders: identityProviders.flatMap(({ code, name }) => {
      const fields = USER_SEARCH_FIELDS.filter((field) =>
        loaded.some(({ capabilities }) => accepts(capabilities, code, [field])),
      );
      return fields.length > 0 ? [{ code, name, fields }] : [];
    }),
  };
}

const filtersOf = (query: UserSearchQuery): Partial<Record<UserSearchField, string>> =>
  Object.fromEntries(
    USER_SEARCH_FIELDS.flatMap((field) => (query[field] ? [[field, query[field]]] : [])),
  );

function failedStatus(code: string, reason: unknown): UserSearchPluginStatus {
  if (reason instanceof ValidationError) return { code, status: 'rejected', truncated: false };
  if (!(reason instanceof ServiceUnavailableError)) {
    log.warn({ plugin: code, failureType: errorName(reason) }, 'User search plugin failed');
  }
  return { code, status: 'unavailable', truncated: false };
}

/**
 * Search every enabled plugin that accepts these filters for this identity provider, and merge
 * the people they find.
 * - 400: the identity provider is not searchable here, no plugin accepts the filters, or every
 *   plugin asked refused them.
 * - 503: no plugin is enabled, one could not be built, or none asked could answer.
 */
export async function searchUsers(
  identityProvider: string,
  query: UserSearchQuery,
  policy: UserSearchPolicy,
  locale: SortLocale,
): Promise<UserSearchResponse> {
  const allowed = await allowedIdentityProviders(policy, locale);
  if (!allowed.some(({ code }) => code === identityProvider)) {
    throw new ValidationError(`${identityProvider} users cannot be searched here`);
  }
  const filters = filtersOf(query);
  const fields = Object.keys(filters) as UserSearchField[];
  const { loaded, failed } = await loadPlugins();
  const eligible = loaded.filter(({ capabilities }) =>
    accepts(capabilities, identityProvider, fields),
  );
  if (eligible.length === 0) {
    // Unavailable rather than invalid when no plugin loaded or one failed to load.
    if (loaded.length === 0 || failed.length > 0) {
      throw new ServiceUnavailableError('User search is unavailable');
    }
    throw new ValidationError('No user search plugin accepts these filters');
  }

  const outcomes = await Promise.allSettled(
    eligible.map(async ({ adapter }) =>
      adapter.search({ identityProvider, filters, limit: PLUGIN_LIMIT }),
    ),
  );
  const plugins: UserSearchPluginStatus[] = [];
  const results: PluginHits[] = [];
  outcomes.forEach((outcome, index) => {
    const { code } = eligible[index];
    if (outcome.status === 'rejected') {
      plugins.push(failedStatus(code, outcome.reason));
      return;
    }
    plugins.push({ code, status: 'ok', truncated: outcome.value.truncated });
    results.push({ code, hits: outcome.value.hits });
  });
  plugins.push(...failed.map((code) => failedStatus(code, new ServiceUnavailableError())));
  if (results.length === 0) {
    if (plugins.some(({ status }) => status === 'unavailable')) {
      throw new ServiceUnavailableError('User search is unavailable');
    }
    throw new ValidationError('Every user search plugin refused the search');
  }

  const people = mergeHits(results);
  const owners = await findIdentityOwners(people);
  const userIds = new Map(
    owners.map((owner) => [identityKey(owner.identityProvider, owner.subject), owner.userId]),
  );
  const users = orderUsers(
    people.map((person) => ({
      ...person,
      displayName: displayNameOf(person),
      sobaUserId: userIds.get(identityKey(person.identityProvider, person.subject)) ?? null,
    })),
    locale,
  );
  return {
    users: users.slice(0, RESULT_LIMIT),
    truncated: users.length > RESULT_LIMIT || plugins.some(({ truncated }) => truncated),
    plugins,
  };
}
