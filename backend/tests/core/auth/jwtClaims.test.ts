import { createEnvReader } from '../../../src/core/config/env';
import { createPluginConfigReaderFrom } from '../../../src/core/config/pluginConfig';
import { profileFromSource, profileHelpers } from '../../../src/core/auth/jwtClaims';
import { idpPluginDefinition } from '../../../src/plugins/idp-bcgov-sso';

describe('jwtClaims', () => {
  it('profileFromSource returns empty object for null', () => {
    expect(profileFromSource(null)).toEqual({});
  });

  it('profileFromSource returns stored profile as-is when has displayName', () => {
    const stored = { displayName: 'Stored', email: 's@b.com' };
    expect(profileFromSource(stored)).toEqual(stored);
  });

  it('profileFromSource returns raw token as-is when no displayName or email or preferredUsername', () => {
    const raw = { name: 'Raw', user_principal_name: 'r@b.com' };
    const result = profileFromSource(raw);
    expect(result).toEqual(raw);
  });

  it('profileHelpers.getDisplayName returns displayName from profile', () => {
    expect(profileHelpers.getDisplayName({ displayName: 'D' })).toBe('D');
  });

  it('profileHelpers.getEmail returns email from profile', () => {
    expect(profileHelpers.getEmail({ email: 'e@x.com' })).toBe('e@x.com');
  });

  it('profileHelpers.getDisplayLabel prefers displayLabel when set', () => {
    const source = { displayLabel: 'Audit Label', displayName: 'D', email: 'a@b.com' };
    expect(profileHelpers.getDisplayLabel(source)).toBe('Audit Label');
  });

  it('profileHelpers.getDisplayLabel falls back to displayName then email when no displayLabel', () => {
    const source = { displayName: 'D', email: 'a@b.com' };
    expect(profileHelpers.getDisplayLabel(source)).toBe('D');
    expect(profileHelpers.getDisplayLabel({ email: 'a@b.com' })).toBe('a@b.com');
  });

  it('profileHelpers.getDisplayLabel returns fallbackSub when no profile fields', () => {
    expect(profileHelpers.getDisplayLabel(null, 'sub-1')).toBe('sub-1');
  });

  it('profileHelpers.getDisplayLabel returns null when source null and no fallback', () => {
    expect(profileHelpers.getDisplayLabel(null)).toBeNull();
  });
});

describe('bcgov-sso IdpClaimMapper', () => {
  const config = createPluginConfigReaderFrom(
    createEnvReader(process.env as Record<string, string | undefined>),
    'bcgov-sso',
  );
  const mapper = idpPluginDefinition.createClaimMapper(config);

  it('mapPayload returns displayName from display_name claim', () => {
    const result = mapper.mapPayload({ display_name: 'John Doe' });
    expect(result.profile.displayName).toBe('John Doe');
  });

  it('mapPayload returns displayName from name when display_name missing', () => {
    const result = mapper.mapPayload({ name: 'Jane Doe' });
    expect(result.profile.displayName).toBe('Jane Doe');
  });

  it('mapPayload builds displayName from given_name and family_name', () => {
    const result = mapper.mapPayload({ given_name: 'John', family_name: 'Doe' });
    expect(result.profile.displayName).toBe('John Doe');
  });

  it('mapPayload returns email from email claim', () => {
    const result = mapper.mapPayload({ email: 'a@b.com' });
    expect(result.profile.email).toBe('a@b.com');
  });

  it('mapPayload returns preferred_username as preferredUsername', () => {
    const result = mapper.mapPayload({ preferred_username: 'jdoe' });
    expect(result.profile.preferredUsername).toBe('jdoe');
  });

  it('mapPayload prefers idir_username over preferred_username and sets displayLabel', () => {
    const result = mapper.mapPayload({
      idir_username: 'IMONTOYA',
      preferred_username: 'sub@azureidir',
    });
    expect(result.profile.preferredUsername).toBe('IMONTOYA');
    expect(result.profile.displayLabel).toBe('IMONTOYA');
  });

  it('mapPayload sets preferredUsername to anonymous for bcservicescard when no username', () => {
    const result = mapper.mapPayload({
      identity_provider: 'bcservicescard',
    });
    expect(result.profile.preferredUsername).toBe('anonymous');
  });

  it('mapPayload sets subject and providerCode', () => {
    const result = mapper.mapPayload({
      sub: 'user-1',
      email: 'a@b.com',
      identity_provider: 'idir',
    });
    expect(result.subject).toBe('user-1');
    expect(result.providerCode).toBe('idir');
  });

  it('mapPayload idpAttributes drops nonce sid session_state jti iat nbf exp', () => {
    const decoded = {
      sub: 'user-1',
      email: 'a@b.com',
      nonce: 'n',
      sid: 's',
      session_state: 'ss',
      jti: 'j',
      iat: 1,
      nbf: 2,
      exp: 3,
    };
    const result = mapper.mapPayload(decoded);
    expect(result.idpAttributes.sub).toBe('user-1');
    expect(result.idpAttributes.email).toBe('a@b.com');
    expect(result.idpAttributes).not.toHaveProperty('nonce');
    expect(result.idpAttributes).not.toHaveProperty('sid');
    expect(result.idpAttributes).not.toHaveProperty('session_state');
    expect(result.idpAttributes).not.toHaveProperty('jti');
    expect(result.idpAttributes).not.toHaveProperty('iat');
    expect(result.idpAttributes).not.toHaveProperty('nbf');
    expect(result.idpAttributes).not.toHaveProperty('exp');
  });
});
