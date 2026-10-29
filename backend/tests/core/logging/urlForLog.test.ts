import { urlForLog } from '../../../src/core/logging/httpLogger';

describe('urlForLog', () => {
  it('omits search filters from form team and workspace candidate URLs', () => {
    expect(urlForLog('/api/v1/design/forms/f1/team/candidates?q=jane%40example.com')).toBe(
      '/api/v1/design/forms/f1/team/candidates',
    );
    expect(urlForLog('/api/v1/design/forms/f1/team?q=Jane')).toBe('/api/v1/design/forms/f1/team');
  });

  it('drops the query string on user search routes', () => {
    expect(
      urlForLog('/api/v1/design/forms/f1/user-search?email=alice%40example.com&identityProvider=x'),
    ).toBe('/api/v1/design/forms/f1/user-search');
    expect(urlForLog('/api/v1/workspaces/w1/user-search/capabilities?locale=fr')).toBe(
      '/api/v1/workspaces/w1/user-search/capabilities',
    );
    expect(urlForLog('/api/v1/workspaces/w1/USER-SEARCH?email=a')).toBe(
      '/api/v1/workspaces/w1/USER-SEARCH',
    );
  });

  it('keeps the query string on other routes, and leaves URLs without one alone', () => {
    expect(urlForLog('/api/v1/design/forms?q=intake')).toBe('/api/v1/design/forms?q=intake');
    expect(urlForLog('/api/v1/user-searches?q=1')).toBe('/api/v1/user-searches?q=1');
    expect(urlForLog('/api/v1/workspaces/w1/user-search')).toBe(
      '/api/v1/workspaces/w1/user-search',
    );
    expect(urlForLog(undefined)).toBeUndefined();
  });
});
