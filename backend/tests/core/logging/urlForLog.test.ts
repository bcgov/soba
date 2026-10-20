import { urlForLog } from '../../../src/core/logging/httpLogger';

describe('urlForLog', () => {
  it('drops the query string on user search routes', () => {
    expect(
      urlForLog('/api/v1/design/forms/f1/user-search/azureidir?email=alice%40example.com'),
    ).toBe('/api/v1/design/forms/f1/user-search/azureidir');
    expect(urlForLog('/api/v1/workspaces/w1/user-search?x=1')).toBe(
      '/api/v1/workspaces/w1/user-search',
    );
    expect(urlForLog('/api/v1/workspaces/w1/USER-SEARCH/azureidir?email=a')).toBe(
      '/api/v1/workspaces/w1/USER-SEARCH/azureidir',
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
