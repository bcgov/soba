import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';

const availability = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock('@/src/shared/featureFlags/featureAvailability', () => ({
  fetchFeatureAvailability: availability.check,
}));

import { useEmailCopyAvailable } from '@/src/features/submitter-email-copy/data/useEmailCopyAvailable';

// One cache for every mount, as the app keeps one for the whole browser session.
const cache = new Map();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>
);
const scope = { workspaceId: 'ws1', formId: 'f1' };

describe('useEmailCopyAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  it('asks again on each mount, so a feature turned on since the last visit shows', async () => {
    availability.check.mockResolvedValue(false);
    const first = renderHook(() => useEmailCopyAvailable(scope), { wrapper });
    await waitFor(() => expect(first.result.current).toBe(false));
    first.unmount();

    availability.check.mockResolvedValue(true);
    const second = renderHook(() => useEmailCopyAvailable(scope), { wrapper });
    await waitFor(() => expect(second.result.current).toBe(true));
    expect(availability.check).toHaveBeenCalledTimes(2);
    expect(availability.check).toHaveBeenLastCalledWith('submitter-email-copy', scope);
  });

  it('asks for a workspace alone when there is no form', async () => {
    availability.check.mockResolvedValue(true);
    const { result } = renderHook(() => useEmailCopyAvailable({ workspaceId: 'ws1' }), {
      wrapper,
    });
    await waitFor(() => expect(result.current).toBe(true));
    expect(availability.check).toHaveBeenCalledWith('submitter-email-copy', {
      workspaceId: 'ws1',
    });
  });

  it('is undefined while the check runs, and false without asking when there is no scope', () => {
    availability.check.mockReturnValue(new Promise(() => undefined));
    expect(
      renderHook(() => useEmailCopyAvailable(scope), { wrapper }).result.current,
    ).toBeUndefined();
    expect(renderHook(() => useEmailCopyAvailable(null), { wrapper }).result.current).toBe(false);
    expect(availability.check).toHaveBeenCalledTimes(1);
  });
});
