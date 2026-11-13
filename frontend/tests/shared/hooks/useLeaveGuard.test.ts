import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
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

afterEach(() => {
  document.body.innerHTML = '';
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

  it('stops asking once unmounted', () => {
    const onLeave = vi.fn();
    const { unmount } = renderHook(() => useLeaveGuard(true, onLeave));
    unmount();
    const { anchor, followed } = link('/en/forms');

    click(anchor);

    expect(onLeave).not.toHaveBeenCalled();
    expect(followed).toHaveBeenCalled();
  });
});
