import {
  isHandledSend,
  isRefusedSend,
} from '../../../../src/core/integrations/notification/sendOutcome';

describe('send outcomes', () => {
  it.each([400, 422])('counts a %i as the provider refusing the address', (httpStatus) => {
    expect(isRefusedSend({ outcome: 'error', httpStatus })).toBe(true);
    expect(isHandledSend({ outcome: 'error', httpStatus })).toBe(true);
  });

  it.each([401, 403, 404, 408, 429, 500, 503, null])(
    'treats an error with status %s as the provider or its gateway, to be retried',
    (httpStatus) => {
      expect(isRefusedSend({ outcome: 'error', httpStatus })).toBe(false);
      expect(isHandledSend({ outcome: 'error', httpStatus })).toBe(false);
    },
  );

  it('counts an accepted send and one the noop plugin skipped as handled', () => {
    expect(isHandledSend({ outcome: 'accepted', httpStatus: null })).toBe(true);
    expect(isHandledSend({ outcome: 'not_sent', httpStatus: null })).toBe(true);
  });

  it('does not count a send skipped because notifications were off', () => {
    expect(isHandledSend({ outcome: 'disabled', httpStatus: null })).toBe(false);
  });
});
