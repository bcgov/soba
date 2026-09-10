'use client';

import { useEffect, useState } from 'react';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed } from './flags';

/**
 * Whether a `fixed` feature is allowed (platform + `NEXT_PUBLIC_SOBA_FEATURES_ALLOWED`), for client
 * components gating rendering below layouts/pages. Fails closed: false until `GET /meta/features`
 * resolves and on any load failure, same as `fetchFeatureAvailability` — never flashes gated UI on.
 * Not for `scoped` features (always false here); use `fetchFeatureAvailability` with a scope instead.
 */
export function useFeatureAllowed(code: string): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const meta = await loadFeaturesMeta().catch(() => null);
      if (active && meta) setAllowed(createIsFeatureAllowed(meta)(code));
    })();
    return () => {
      active = false;
    };
  }, [code]);

  return allowed;
}
