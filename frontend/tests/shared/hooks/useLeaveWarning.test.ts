import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLeaveWarning } from '@/src/shared/hooks/useLeaveWarning';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

/** Whether the browser would be told to confirm leaving. */
const leaveIsHeld = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

/** Clicks a link to `href` and says whether the click was held. */
const clickLink = (href: string, attrs: Record<string, string> = {}, init: MouseEventInit = {}) => {
  const link = document.createElement('a');
  link.href = href;
  for (const [name, value] of Object.entries(attrs)) link.setAttribute(name, value);
  document.body.appendChild(link);
  // A held click never reaches the link; one let through is stopped here, as jsdom cannot navigate.
  let reached = false;
  link.addEventListener('click', (event) => {
    reached = true;
    event.preventDefault();
  });
  act(() => {
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
  });
  return !reached;
};

// A stand-in for the browser's Navigation API, which jsdom lacks.
const navigation = Object.assign(new EventTarget(), {
  traverseTo: vi.fn(() => ({ finished: Promise.resolve() })),
});
const traverse = (cancelable = true, url = 'http://localhost/en/forms') => {
  const event = Object.assign(new Event('navigate', { cancelable }), {
    navigationType: 'traverse',
    destination: { key: 'back-key', url },
  });
  act(() => {
    navigation.dispatchEvent(event);
  });
  return event.defaultPrevented;
};

afterEach(() => {
  document.body.innerHTML = '';
  push.mockClear();
  navigation.traverseTo.mockClear();
  delete (window as { navigation?: unknown }).navigation;
  vi.unstubAllEnvs();
});

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

  it('lets go on unmount', () => {
    const { unmount } = renderHook(() => useLeaveWarning(true));
    expect(leaveIsHeld()).toBe(true);

    unmount();
    expect(leaveIsHeld()).toBe(false);
  });

  it('holds a link to another page, then leaves to it', () => {
    const { result } = renderHook(() => useLeaveWarning(true));

    expect(clickLink('/en/forms?page=2')).toBe(true);
    expect(result.current.leaving).toBe(true);

    result.current.leave();
    expect(push).toHaveBeenCalledWith('/en/forms?page=2');
  });

  it('stays when asked', () => {
    const { result } = renderHook(() => useLeaveWarning(true));
    clickLink('/en/forms');

    act(() => result.current.stay());
    expect(result.current.leaving).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('lets through links that do not leave the page in this tab', () => {
    const { result } = renderHook(() => useLeaveWarning(true));

    expect(clickLink(`${location.pathname}?tab=settings`)).toBe(false);
    expect(clickLink('https://example.com/elsewhere')).toBe(false);
    expect(clickLink('/en/forms', { target: '_blank' })).toBe(false);
    expect(clickLink('/en/forms', { download: '' })).toBe(false);
    expect(clickLink('/en/forms', {}, { ctrlKey: true })).toBe(false);
    expect(result.current.leaving).toBe(false);
  });

  it('holds nothing while inactive', () => {
    const { result } = renderHook(() => useLeaveWarning(false));

    expect(clickLink('/en/forms')).toBe(false);
    expect(result.current.leaving).toBe(false);
  });

  describe('under a base path', () => {
    it('leaves to the app path, as the router adds the base path itself', () => {
      vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/designer');
      const { result } = renderHook(() => useLeaveWarning(true));

      expect(clickLink('/designer/en/forms?page=2')).toBe(true);
      result.current.leave();
      expect(push).toHaveBeenCalledWith('/en/forms?page=2');
    });

    it('leaves to the app root for a link to the base path itself', () => {
      vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/designer');
      const { result } = renderHook(() => useLeaveWarning(true));

      expect(clickLink('/designer')).toBe(true);
      result.current.leave();
      expect(push).toHaveBeenCalledWith('/');
    });

    it('lets through a link to another app on this origin', () => {
      vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/designer');
      renderHook(() => useLeaveWarning(true));

      expect(clickLink('/forms/en/form/f1')).toBe(false);
      expect(clickLink('/designer-old/en')).toBe(false);
    });
  });

  describe('hold', () => {
    it('pushes at once while inactive', () => {
      const { result } = renderHook(() => useLeaveWarning(false));

      act(() => result.current.hold('/en/forms'));
      expect(push).toHaveBeenCalledWith('/en/forms');
      expect(result.current.leaving).toBe(false);
    });

    it('holds the push while active, then pushes once confirmed', () => {
      const { result } = renderHook(() => useLeaveWarning(true));

      act(() => result.current.hold('/en/forms'));
      expect(push).not.toHaveBeenCalled();
      expect(result.current.leaving).toBe(true);

      result.current.leave();
      expect(push).toHaveBeenCalledWith('/en/forms');
    });
  });

  describe('Back and Forward', () => {
    it('holds one the browser lets the page cancel, then goes once confirmed', () => {
      Object.assign(window, { navigation });
      const { result } = renderHook(() => useLeaveWarning(true));

      expect(traverse()).toBe(true);
      expect(result.current.leaving).toBe(true);

      act(() => result.current.leave());
      expect(navigation.traverseTo).toHaveBeenCalledWith('back-key');
      // Its own traversal is not held again.
      expect(traverse()).toBe(false);
    });

    it('lets through one that stays on this page', () => {
      Object.assign(window, { navigation });
      const { result } = renderHook(() => useLeaveWarning(true));

      expect(traverse(true, `${location.origin}${location.pathname}?tab=settings`)).toBe(false);
      expect(result.current.leaving).toBe(false);
    });

    it('holds Back again when the confirmed traversal fails', async () => {
      Object.assign(window, { navigation });
      navigation.traverseTo.mockReturnValueOnce({ finished: Promise.reject(new Error('gone')) });
      const { result } = renderHook(() => useLeaveWarning(true));
      traverse();

      await act(async () => result.current.leave());
      expect(traverse()).toBe(true);
    });

    it('lets through one the browser does not let the page cancel', () => {
      Object.assign(window, { navigation });
      const { result } = renderHook(() => useLeaveWarning(true));

      expect(traverse(false)).toBe(false);
      expect(result.current.leaving).toBe(false);
    });

    it('holds nothing while inactive', () => {
      Object.assign(window, { navigation });
      renderHook(() => useLeaveWarning(false));

      expect(traverse()).toBe(false);
    });

    it('still guards links where the browser has no Navigation API', () => {
      const { result } = renderHook(() => useLeaveWarning(true));

      expect(clickLink('/en/forms')).toBe(true);
      expect(result.current.leaving).toBe(true);
    });
  });
});
