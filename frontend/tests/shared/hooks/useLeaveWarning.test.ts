import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLeaveWarning } from '@/src/shared/hooks/useLeaveWarning';

/** Whether the browser would be told to confirm leaving. */
const leaveIsHeld = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('useLeaveWarning', () => {
  it('holds a refresh or close only while active', () => {
    const { rerender } = renderHook(({ active }) => useLeaveWarning(active), {
      initialProps: { active: false },
    });
    expect(leaveIsHeld()).toBe(false);

    rerender({ active: true });
    expect(leaveIsHeld()).toBe(true);

    rerender({ active: false });
    expect(leaveIsHeld()).toBe(false);
  });

  // A leave already agreed to navigates before the re-render that would turn the warning off.
  it('lets go at once when released', () => {
    const { result } = renderHook(() => useLeaveWarning(true));
    expect(leaveIsHeld()).toBe(true);

    result.current();
    expect(leaveIsHeld()).toBe(false);
  });

  it('lets go on unmount', () => {
    const { unmount } = renderHook(() => useLeaveWarning(true));
    expect(leaveIsHeld()).toBe(true);

    unmount();
    expect(leaveIsHeld()).toBe(false);
  });
});
