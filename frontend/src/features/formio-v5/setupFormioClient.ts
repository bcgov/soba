import { Formio } from '@formio/js';
import { registerFormioSobaAuthPlugin } from './registerFormioSobaAuthPlugin';
import { getFormioProxyBaseUrl } from '@/src/shared/config/runtimeConfig';

let didSetup = false;

/**
 * Idempotent: register the Form.io fetch plugin (Keycloak Bearer).
 * When mounting `@formio/react` `<Form />`, also sets up the global window.Formio
 * reference so that Components.setComponents(window.Formio.AllComponents) works
 * correctly and populates the builder sidebar.
 */
export function setupFormioClient(): void {
  if (typeof window === 'undefined' || didSetup) return;
  didSetup = true;

  // Required: Components.js checks window.Formio.AllComponents to self-register.
  // Without this the builder sidebar stays empty.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Formio = Formio;

  // Register all built-in components explicitly (belt-and-suspenders).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((Formio as any).AllComponents && (Formio as any).Components) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Formio as any).Components.setComponents((Formio as any).AllComponents);
  }

  Formio.setBaseUrl(getFormioProxyBaseUrl());
  registerFormioSobaAuthPlugin();
}
