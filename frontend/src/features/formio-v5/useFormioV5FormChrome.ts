'use client';

import { useEffect } from 'react';

const STYLES = [
  { id: 'soba-formio-bootstrap', href: '/formio-v5/bootstrap.min.css' },
  { id: 'soba-formio-form', href: '/formio-v5/formio.form.min.css' },
] as const;

/**
 * Injects Form.io renderer stylesheets only while the form renderer is mounted.
 * Static copies live under `public/formio-v5/` (maintain by hand when upgrading Bootstrap / @formio/js).
 * Scoped operationally to this feature (not global layout); selectors in the CSS
 * are still Form.io/Bootstrap-prefixed where possible, but some rules are global by design.
 */
export function useFormioV5FormChrome(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const added: HTMLLinkElement[] = [];
    for (const { id, href } of STYLES) {
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      added.push(link);
    }

    return () => {
      for (const link of added) {
        link.remove();
      }
    };
  }, [enabled]);
}
