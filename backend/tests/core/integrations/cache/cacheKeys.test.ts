import { membershipKey } from '../../../../src/core/integrations/cache/cacheKeys';

describe('cacheKeys', () => {
  it('membershipKey returns format membership:workspaceId:userId', () => {
    expect(membershipKey('ws-1', 'user-1')).toBe('membership:ws-1:user-1');
  });

  it('membershipKey includes both workspaceId and userId', () => {
    const key = membershipKey('abc', 'xyz');
    expect(key).toContain('abc');
    expect(key).toContain('xyz');
    expect(key).toMatch(/^membership:.+:.+$/);
  });
});
