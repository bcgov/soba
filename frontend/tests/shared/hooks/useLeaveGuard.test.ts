import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { requestLeave, useLeaveGuard } from '@/src/shared/hooks/useLeaveGuard';

/** A link in the page, standing in for the side navigation's. Its own click handler records a follow. */
function link(href: string, attrs: Record<string, string> = {}) {
  const anchor = document.createElement('a');
  anchor.href = href;
  for (const [name, value] of Object.entries(attrs)) anchor.setAttribute(name, value);
  const followed = vi.fn((event: MouseEvent) => event.preventDefault());
  anchor.addEventListener('click', followed);
  document.body.appendChild(anchor);
  return { anchor, followed };
}

const click = (anchor: HTMLAnchorElement, init: MouseEventInit = {}) =>
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));

// A stand-in for the browser's Navigation API, which jsdom lacks.
const navigation = Object.assign(new EventTarget(), {
  traverseTo: vi.fn(() => ({ finished: Promise.resolve() })),
});

/** Dispatches a Back to `url` and says whether the page held it. */
const traverse = (cancelable = true, url = 'http://localhost/en/forms') => {
  const event = Object.assign(new Event('navigate', { cancelable }), {
    navigationType: 'traverse',
    destination: { key: 'back-key', url },
  });
  navigation.dispatchEvent(event);
  return event.defaultPrevented;
};

afterEach(() => {
  document.body.innerHTML = '';
  navigation.traverseTo.mockClear();
  delete (window as { navigation?: unknown }).navigation;
});

describe('useLeaveGuard', () => {
  it('asks before an in-app link is followed, and follows it once the person agrees', () => {
    const onLeave = vi.fn();
    renderHook(() => useLeaveGuard(true, onLeave));
    const { anchor, followed } = link('/en/forms');

    click(anchor);

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(followed).not.toHaveBeenCalled();

    const proceed = onLeave.mock.calls[0][0] as () => void;
    proceed();

    expect(followed).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('lets links through while there is nothing unsaved', () => {
    const onLeave = vi.fn();
    renderHook(() => useLeaveGuard(false, onLeave));
    const { anchor, followed } = link('/en/forms');

    click(anchor);

    expect(onLeave).not.toHaveBeenCalled();
    expect(followed).toHaveBeenCalled();
  });

  // These leave this page as it is.
  it('lets a new-tab click, another site and a download through', () => {
    const onLeave = vi.fn();
    renderHook(() => useLeaveGuard(true, onLeave));

    click(link('/en/forms').anchor, { metaKey: true });
    click(link('/en/forms', { target: '_blank' }).anchor);
    click(link('https://example.com/elsewhere').anchor);
    click(link('/files/export.csv', { download: '' }).anchor);

    expect(onLeave).not.toHaveBeenCalled();
  });

  it('lets a jump within the page through', () => {
    const onLeave = vi.fn();
    renderHook(() => useLeaveGuard(true, onLeave));

    click(link(`${window.location.pathname}${window.location.search}#main-content`).anchor);

    expect(onLeave).not.toHaveBeenCalled();
  });

  it('asks before a navigation that is not a link', () => {
    const onLeave = vi.fn();
    const go = vi.fn();
    const { rerender } = renderHook(({ active }) => useLeaveGuard(active, onLeave), {
      initialProps: { active: true },
    });

    requestLeave(go);
    expect(go).not.toHaveBeenCalled();
    (onLeave.mock.calls[0][0] as () => void)();
    expect(go).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    requestLeave(go);
    expect(go).toHaveBeenCalledTimes(2);
  });

  // Logout navigates as soon as the person agrees, before the page re-renders, so the browser must
  // not ask again on the way out.
  it('lets the browser leave without asking again once the person agrees', () => {
    const onLeave = vi.fn();
    renderHook(() => useLeaveGuard(true, onLeave));
    let held: boolean | null = null;
    const leaveIsHeld = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    requestLeave(() => {
      held = leaveIsHeld();
    });
    expect(leaveIsHeld()).toBe(true);
    (onLeave.mock.calls[0][0] as () => void)();

    expect(held).toBe(false);
  });

  it('stops asking once unmounted', () => {
    const onLeave = vi.fn();
    const { unmount } = renderHook(() => useLeaveGuard(true, onLeave));
    unmount();
    const { anchor, followed } = link('/en/forms');

    click(anchor);

    expect(onLeave).not.toHaveBeenCalled();
    expect(followed).toHaveBeenCalled();
  });

  describe('Back and Forward', () => {
    it('asks before one the browser lets the page cancel, and goes once the person agrees', () => {
      Object.assign(window, { navigation });
      const onLeave = vi.fn();
      renderHook(() => useLeaveGuard(true, onLeave));

      expect(traverse()).toBe(true);
      expect(onLeave).toHaveBeenCalledTimes(1);

      (onLeave.mock.calls[0][0] as () => void)();
      expect(navigation.traverseTo).toHaveBeenCalledWith('back-key');
      // Its own traversal is not held again.
      expect(traverse()).toBe(false);
    });

    it('lets through one the browser does not let the page cancel', () => {
      Object.assign(window, { navigation });
      const onLeave = vi.fn();
      renderHook(() => useLeaveGuard(true, onLeave));

      expect(traverse(false)).toBe(false);
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('lets through one that stays on this page', () => {
      Object.assign(window, { navigation });
      const onLeave = vi.fn();
      renderHook(() => useLeaveGuard(true, onLeave));

      const here = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      expect(traverse(true, `${here}#main-content`)).toBe(false);
    });

    it('holds Back again when the agreed traversal fails', async () => {
      Object.assign(window, { navigation });
      navigation.traverseTo.mockReturnValueOnce({ finished: Promise.reject(new Error('gone')) });
      const onLeave = vi.fn();
      renderHook(() => useLeaveGuard(true, onLeave));
      traverse();

      await act(async () => (onLeave.mock.calls[0][0] as () => void)());
      expect(traverse()).toBe(true);
    });

    it('holds nothing while there is nothing unsaved', () => {
      Object.assign(window, { navigation });
      const onLeave = vi.fn();
      renderHook(() => useLeaveGuard(false, onLeave));

      expect(traverse()).toBe(false);
    });
  });
});
