'use client';

import { useEffect, useState } from 'react';
import { loadFilesConfig, toBcgovFileOption } from './loadFilesConfig';
import { ensureBcgovFormioRegistered } from './registerBcgovFormio';

/**
 * The `options.bcgovFile` (blocked extensions + max upload size) the BCGovFile component reads, or {}
 * when the files feature is off. Gated on the same enablement as the CHEFS provider registration, so
 * no file config is fetched — and no file code runs — when files are disabled. `loadFilesConfig` is
 * cached, so this is deduped across every renderer that uses it.
 */
export function useBcgovFileOption(): Record<string, unknown> {
  const [option, setOption] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let active = true;
    void (async () => {
      const { filesEnabled } = await ensureBcgovFormioRegistered();
      if (!active || !filesEnabled) return;
      const config = await loadFilesConfig();
      if (active) setOption(toBcgovFileOption(config));
    })();
    return () => {
      active = false;
    };
  }, []);

  return option;
}
