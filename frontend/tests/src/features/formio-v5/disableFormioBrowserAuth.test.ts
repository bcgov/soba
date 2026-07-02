import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@formio/js', () => ({
  Formio: {
    setToken: vi.fn(),
    setUser: vi.fn(),
  },
}));

import { Formio } from '@formio/js';
import { disableFormioBrowserAuth } from '@/src/features/formio-v5/disableFormioBrowserAuth';

describe('disableFormioBrowserAuth', () => {
  beforeEach(() => {
    vi.mocked(Formio.setToken).mockClear();
    vi.mocked(Formio.setUser).mockClear();
    localStorage.clear();
  });

  it('clears Form.io SDK auth state and localStorage keys', async () => {
    localStorage.setItem('formioToken', 'stale-jwt');
    localStorage.setItem('formioUser', '{"_id":"1"}');

    disableFormioBrowserAuth();

    expect(localStorage.getItem('formioToken')).toBeNull();
    expect(localStorage.getItem('formioUser')).toBeNull();

    await vi.waitFor(() => {
      expect(Formio.setToken).toHaveBeenCalledWith('');
      expect(Formio.setUser).toHaveBeenCalledWith(null);
    });
  });
});
