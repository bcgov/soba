'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Heading } from '@bcgov/design-system-react-components';
import type { PluginNavItem } from '@/src/app/plugins/types';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type NavOverlayProps = {
  open: boolean;
  onClose: () => void;
  topPx: number;
  navItems: PluginNavItem[];
  panelTitle: string;
  panelId: string;
};

export function NavOverlay({ open, onClose, topPx, navItems, panelTitle, panelId }: NavOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `${panelId}-title`;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.closest('[aria-hidden="true"]'),
      );

    const focusables = getFocusable();
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const id = window.requestAnimationFrame(() => first?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || focusables.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, navItems]);

  if (typeof document === 'undefined') return null;
  if (!open) return null;

  const heightExpr = `calc(100dvh - ${topPx}px)`;

  return createPortal(
    <div
      className="fixed left-0 right-0 z-[100] box-border overflow-hidden"
      style={{ top: topPx, height: heightExpr }}
    >
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="box-border h-full overflow-y-auto border-t border-[var(--surface-color-border-default)] bg-[var(--surface-color-forms-default)] px-4 py-6 shadow-[var(--surface-shadow-small)]"
      >
        <Heading id={titleId} level={2} className="mb-4">
          {panelTitle}
        </Heading>
        <nav aria-label={panelTitle}>
          <ul className="flex flex-col gap-3">
            {navItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="underline underline-offset-[var(--layout-padding-hair)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>,
    document.body,
  );
}
