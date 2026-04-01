'use client';

import { registerFormioSobaAuthPlugin } from './registerFormioSobaAuthPlugin';

let didSetup = false;

/**
 * Idempotent: register the Form.io fetch plugin (Keycloak Bearer).
 * When mounting `@formio/react` `<Form />`, load Form.io form styles from `public/formio-v5/`
 * via `useFormioV5FormChrome` (not a bundled CSS import — Turbopack chokes on that pipeline).
 */
export function setupFormioClient(): void {
  if (typeof window === 'undefined' || didSetup) return;
  didSetup = true;
  registerFormioSobaAuthPlugin();
}
