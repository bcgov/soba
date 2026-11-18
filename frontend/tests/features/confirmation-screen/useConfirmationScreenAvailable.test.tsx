import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';

const availability = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock('@/src/shared/featureFlags/featureAvailability', () => ({
  fetchFeatureAvailability: availability.check,
}));

import {
  hasConfirmationSettings,
  useConfirmationScreenAvailable,
} from '@/src/features/confirmation-screen/data/useConfirmationScreenAvailable';

// One cache for every mount, as the app keeps one for the whole browser session.
const cache = new Map();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>
);
const scope = { workspaceId: 'ws1', formId: 'f1' };
const featuresOff = (...codes: string[]) =>
  availability.check.mockImplementation((code: string) => Promise.resolve(!codes.includes(code)));

describe('useConfirmationScreenAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  it('asks for the group, each setting and notifications, for the scope', async () => {
    featuresOff();
    const { result } = renderHook(() => useConfirmationScreenAvailable(scope), { wrapper });
    await waitFor(() =>
      expect(result.current).toEqual({
        settings: { allowSubmitterEmailCopy: true, showConfirmationId: true },
        notifications: true,
      }),
    );
    for (const code of [
      'confirmation-screen',
      'confirmation-email-copy',
      'confirmation-id-visibility',
      'notifications',
    ]) {
      expect(availability.check).toHaveBeenCalledWith(code, scope);
    }
  });

  it('takes every setting off with the group', async () => {
    featuresOff('confirmation-screen');
    const { result } = renderHook(() => useConfirmationScreenAvailable(scope), { wrapper });
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.settings).toEqual({
      allowSubmitterEmailCopy: false,
      showConfirmationId: false,
    });
    expect(hasConfirmationSettings(result.current)).toBe(false);
  });

  it('takes a setting off with its own feature, and says when notifications are off', async () => {
    featuresOff('confirmation-email-copy', 'notifications');
    const { result } = renderHook(() => useConfirmationScreenAvailable(scope), { wrapper });
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toEqual({
      settings: { allowSubmitterEmailCopy: false, showConfirmationId: true },
      notifications: false,
    });
    expect(hasConfirmationSettings(result.current)).toBe(true);
  });

  it('asks again on each mount, so a feature turned on since the last visit shows', async () => {
    featuresOff('confirmation-screen');
    const first = renderHook(() => useConfirmationScreenAvailable(scope), { wrapper });
    await waitFor(() => expect(hasConfirmationSettings(first.result.current)).toBe(false));
    first.unmount();

    featuresOff();
    const second = renderHook(() => useConfirmationScreenAvailable(scope), { wrapper });
    await waitFor(() => expect(hasConfirmationSettings(second.result.current)).toBe(true));
  });

  it('is undefined while the checks run, and shows nothing without asking when there is no scope', () => {
    availability.check.mockReturnValue(new Promise(() => undefined));
    const running = renderHook(() => useConfirmationScreenAvailable(scope), { wrapper });
    expect(running.result.current).toBeUndefined();
    expect(hasConfirmationSettings(running.result.current)).toBeUndefined();
    const calls = availability.check.mock.calls.length;

    const none = renderHook(() => useConfirmationScreenAvailable(null), { wrapper });
    expect(hasConfirmationSettings(none.result.current)).toBe(false);
    expect(availability.check).toHaveBeenCalledTimes(calls);
  });
});
