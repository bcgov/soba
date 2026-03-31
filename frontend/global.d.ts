export {};

declare global {
  interface Window {
    __SOBA_API_BASE_URL?: string;
    /** Set from root layout so client bundles honor runtime `NEXT_PUBLIC_SOBA_FEATURES_ALLOWED` (e.g. Docker). */
    __SOBA_FEATURES_ALLOWED?: string;
  }
}
