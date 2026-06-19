/**
 * Configure the browser Form.io SDK for JSON-only rendering: no JWT, no calls to api.form.io.
 * SOBA loads schemas and submissions via its own API; @formio/js is layout/runtime only.
 *
 * Uses {@link Formio.setToken} / {@link Formio.setUser} (SDK API) plus localStorage cleanup for
 * any stale values. Call on auth init/logout and whenever a Form.io component mounts.
 *
 * Must not statically import @formio/js — it touches `document` at module load and this file is
 * pulled in through the Redux store during SSR.
 */
export function disableFormioBrowserAuth(): void {
  if (!('window' in globalThis)) return;

  localStorage.removeItem('formioToken');
  localStorage.removeItem('formioUser');

  void import('@formio/js').then(({ Formio }) => {
    Formio.setToken('');
    Formio.setUser(null);
  });
}
