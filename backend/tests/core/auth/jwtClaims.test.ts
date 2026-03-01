import {
  normalizeProfileFromJwt,
  idpAttributesFromJwt,
  profileFromSource,
  profileHelpers,
} from '../../../src/core/auth/jwtClaims';

describe('jwtClaims', () => {
  it('normalizeProfileFromJwt returns displayName from display_name claim', () => {
    const result = normalizeProfileFromJwt({ display_name: 'John Doe' });
    expect(result.displayName).toBe('John Doe');
  });

  it('normalizeProfileFromJwt returns displayName from name when display_name missing', () => {
    const result = normalizeProfileFromJwt({ name: 'Jane Doe' });
    expect(result.displayName).toBe('Jane Doe');
  });

  it('normalizeProfileFromJwt builds displayName from given_name and family_name', () => {
    const result = normalizeProfileFromJwt({ given_name: 'John', family_name: 'Doe' });
    expect(result.displayName).toBe('John Doe');
  });

  it('normalizeProfileFromJwt returns email from email claim', () => {
    const result = normalizeProfileFromJwt({ email: 'a@b.com' });
    expect(result.email).toBe('a@b.com');
  });

  it('normalizeProfileFromJwt returns preferred_username as preferredUsername', () => {
    const result = normalizeProfileFromJwt({ preferred_username: 'jdoe' });
    expect(result.preferredUsername).toBe('jdoe');
  });

  it('normalizeProfileFromJwt prefers idir_username over preferred_username', () => {
    const result = normalizeProfileFromJwt({
      idir_username: 'IMONTOYA',
      preferred_username: 'sub@azureidir',
    });
    expect(result.preferredUsername).toBe('IMONTOYA');
  });

  it('normalizeProfileFromJwt sets preferredUsername to anonymous for bcservicescard when no username', () => {
    const result = normalizeProfileFromJwt({
      identity_provider: 'bcservicescard',
    });
    expect(result.preferredUsername).toBe('anonymous');
  });

  it('normalizeProfileFromJwt omits session claims from result', () => {
    const result = normalizeProfileFromJwt({
      sub: 'user-1',
      email: 'a@b.com',
      iat: 123,
      exp: 456,
      nonce: 'n',
      sid: 's',
    });
    expect(result.email).toBe('a@b.com');
    expect(result.preferredUsername).toBe('user-1');
  });

  it('idpAttributesFromJwt drops nonce sid session_state jti iat nbf exp', () => {
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
    const result = idpAttributesFromJwt(decoded);
    expect(result.sub).toBe('user-1');
    expect(result.email).toBe('a@b.com');
    expect(result).not.toHaveProperty('nonce');
    expect(result).not.toHaveProperty('sid');
    expect(result).not.toHaveProperty('session_state');
    expect(result).not.toHaveProperty('jti');
    expect(result).not.toHaveProperty('iat');
    expect(result).not.toHaveProperty('nbf');
    expect(result).not.toHaveProperty('exp');
  });

  it('profileFromSource returns empty object for null', () => {
    expect(profileFromSource(null)).toEqual({});
  });

  it('profileFromSource returns stored profile as-is when has displayName', () => {
    const stored = { displayName: 'Stored', email: 's@b.com' };
    expect(profileFromSource(stored)).toEqual(stored);
  });

  it('profileFromSource normalizes raw token when no displayName or email or preferredUsername', () => {
    const raw = { name: 'Raw', user_principal_name: 'r@b.com' };
    const result = profileFromSource(raw);
    expect(result.displayName).toBe('Raw');
    expect(result.email).toBe('r@b.com');
  });

  it('profileHelpers.getDisplayName returns displayName from profile', () => {
    expect(profileHelpers.getDisplayName({ displayName: 'D' })).toBe('D');
  });

  it('profileHelpers.getEmail returns email from profile', () => {
    expect(profileHelpers.getEmail({ email: 'e@x.com' })).toBe('e@x.com');
  });

  it('profileHelpers.getDisplayLabel prefers idir_username over email', () => {
    const source = {
      idir_username: 'IDIR',
      email: 'a@b.com',
      displayName: 'D',
    };
    expect(profileHelpers.getDisplayLabel(source)).toBe('IDIR');
  });

  it('profileHelpers.getDisplayLabel prefers bceid_username then email', () => {
    const source = { bceid_username: 'BCEID', email: 'a@b.com' };
    expect(profileHelpers.getDisplayLabel(source)).toBe('BCEID');
  });

  it('profileHelpers.getDisplayLabel returns fallbackSub when no profile fields', () => {
    expect(profileHelpers.getDisplayLabel(null, 'sub-1')).toBe('sub-1');
  });

  it('profileHelpers.getDisplayLabel returns null when source null and no fallback', () => {
    expect(profileHelpers.getDisplayLabel(null)).toBeNull();
  });
});
