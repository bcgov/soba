/**
 * BC Gov SSO IdP plugin. One plugin for the whole BC Gov Keycloak realm;
 * handles all idpTypes (IDIR, Azure IDIR, BCeID Basic, BCeID Business, BC Services Card).
 */
import type { Request } from 'express';
import type { PluginConfigReader } from '../../core/config/pluginConfig';
import type {
  IdpPluginDefinition,
  IdpClaimMapper,
  IdpMapPayloadResult,
} from '../../auth/IdpPlugin';
import type { NormalizedProfile, IdpAttributes } from '../../core/auth/jwtClaims';
import { authEnv } from '../../config/authEnv';
import {
  firstString,
  firstEmailLike,
  sanitizeIdpAttributes,
  createJwksExpressMiddleware,
} from './jwksHelpers';

const CLAIM_DISPLAY_NAME = ['display_name', 'display_name_alt', 'name'] as const;
const CLAIM_EMAIL = ['email', 'user_principal_name', 'upn', 'preferred_username'] as const;
const CLAIM_FIRST_NAME = ['given_name', 'given_names'] as const;
const CLAIM_LAST_NAME = ['family_name'] as const;
const CLAIM_USERNAME = ['idir_username', 'bceid_username', 'preferred_username', 'sub'] as const;

function normalizeProfile(decoded: Record<string, unknown>): NormalizedProfile {
  const displayName =
    firstString(decoded, CLAIM_DISPLAY_NAME) ||
    (() => {
      const given = typeof decoded.given_name === 'string' ? decoded.given_name.trim() : '';
      const family = typeof decoded.family_name === 'string' ? decoded.family_name.trim() : '';
      if (given || family) return [given, family].filter(Boolean).join(' ').trim();
      return null;
    })() ||
    firstString(decoded, CLAIM_USERNAME) ||
    (typeof decoded.sub === 'string' ? decoded.sub : null);

  const email =
    firstEmailLike(decoded, CLAIM_EMAIL) || firstEmailLike(decoded, ['preferred_username']);

  let preferredUsername =
    firstString(decoded, CLAIM_USERNAME) || (typeof decoded.sub === 'string' ? decoded.sub : null);
  const idp =
    typeof decoded.identity_provider === 'string' ? decoded.identity_provider.toLowerCase() : '';
  if (!preferredUsername && (idp === 'bcservicescard' || idp === 'bcsc')) {
    preferredUsername = 'anonymous';
  }

  const firstName = firstString(decoded, CLAIM_FIRST_NAME) ?? null;
  const lastName = firstString(decoded, CLAIM_LAST_NAME) ?? null;
  const name = firstString(decoded, ['name']) ?? null;
  const idirUsername = firstString(decoded, ['idir_username']) ?? null;
  const bceidUsername = firstString(decoded, ['bceid_username']) ?? null;

  const profile: NormalizedProfile = {
    displayName: displayName ?? null,
    email: email ?? null,
    preferredUsername: preferredUsername ?? null,
    firstName,
    lastName,
    name,
    idir_username: idirUsername,
    bceid_username: bceidUsername,
  };

  const displayLabel =
    idirUsername ||
    bceidUsername ||
    email ||
    name ||
    displayName ||
    preferredUsername ||
    (typeof decoded.sub === 'string' ? decoded.sub : null);
  profile.displayLabel = displayLabel ?? null;

  return profile;
}

function getProviderCode(decoded: Record<string, unknown>): string {
  const idp: string =
    typeof decoded.identity_provider === 'string'
      ? decoded.identity_provider
      : typeof (decoded as Record<string, unknown>).idpType === 'string'
        ? ((decoded as Record<string, unknown>).idpType as string)
        : 'idir';
  return idp;
}

function getSubject(decoded: Record<string, unknown>): string {
  const sub = decoded.sub;
  if (typeof sub === 'string') return sub;
  if (typeof sub === 'number') return String(sub);
  return '';
}

class BcgovSsoClaimMapper implements IdpClaimMapper {
  mapPayload(payload: Record<string, unknown>): IdpMapPayloadResult {
    const profile = normalizeProfile(payload);
    const idpAttributes = sanitizeIdpAttributes(payload) as IdpAttributes;
    return {
      subject: getSubject(payload),
      providerCode: getProviderCode(payload),
      profile,
      idpAttributes,
    };
  }
}

export const idpPluginDefinition: IdpPluginDefinition = {
  code: 'bcgov-sso',

  createAuthMiddleware(config: PluginConfigReader) {
    const jwksUri = config.getOptional('JWKS_URI') ?? authEnv.getIdpPluginDefaultSsoJwksUri();
    const issuer = config.getOptional('JWT_ISSUER') ?? authEnv.getIdpPluginDefaultSsoJwtIssuer();
    const audience =
      config.getOptional('JWT_AUDIENCE') ??
      authEnv.getIdpPluginDefaultSsoJwtAudience() ??
      undefined;

    const jwtMiddleware = createJwksExpressMiddleware({
      jwksUri,
      issuer,
      audience,
    });

    return (req: Request, res: unknown, next: (err?: unknown) => void) => {
      jwtMiddleware(req, res as import('express').Response, (err?: unknown) => {
        if (err) return next(err);
        const decoded = (req as Request & { decodedJwt?: Record<string, unknown> }).decodedJwt;
        if (decoded) {
          (req as Request & { authPayload?: Record<string, unknown> }).authPayload = decoded;
          (req as Request & { idpType?: string }).idpType = getProviderCode(decoded);
          (req as Request & { idpPluginCode?: string }).idpPluginCode = 'bcgov-sso';
        }
        next();
      });
    };
  },

  // Config not used by this mapper; required by IdpPluginDefinition.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createClaimMapper(config: PluginConfigReader): IdpClaimMapper {
    return new BcgovSsoClaimMapper();
  },
};
