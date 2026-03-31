'use client';

import { Formio } from '@formio/js';
import { getKeycloakInstance } from '@/lib/slices/keycloakSlice';

let registered = false;

type PreRequestArgs = {
  opts?: {
    headers?: Record<string, string>;
    header?: unknown;
  };
};

/**
 * Registers a Form.io fetch plugin that adds Keycloak Authorization on every SDK request.
 * Safe to call multiple times (no-op after first registration).
 */
export function registerFormioSobaAuthPlugin(): void {
  if (typeof window === 'undefined' || registered) return;
  registered = true;

  Formio.registerPlugin(
    {
      priority: 10,
      preRequest(requestArgs: PreRequestArgs): Promise<void> | void {
        const kc = getKeycloakInstance();
        if (!kc?.authenticated) return;

        return kc.updateToken(30).then((refreshed) => {
          if (refreshed === false && !kc.token) return;
          const token = kc.token;
          if (!token) return;
          requestArgs.opts = requestArgs.opts ?? {};
          requestArgs.opts.headers = {
            ...(typeof requestArgs.opts.headers === 'object' && requestArgs.opts.headers !== null
              ? requestArgs.opts.headers
              : {}),
            Authorization: `Bearer ${token}`,
          };
        });
      },
    },
    'sobaKeycloakBearer',
  );
}
