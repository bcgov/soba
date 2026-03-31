/**
 * Soba core REST for forms (metadata, versions, etc.). Extend as v1 endpoints are added.
 * Form.io v5 engine traffic: {@link fetchFormioProxyGet} against the `/formio-v5` proxy.
 */
export { fetchFormioProxyGet, type FormioProxyFetchResult } from './api/formioProxyApi';
export { getFormioProxyBaseUrl } from '@/src/shared/config/runtimeConfig';
