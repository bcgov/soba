import { INTEGRATION_API_DOCS_NAME } from '@soba/lib';
import { getSobaApiBaseUrl } from '@/src/shared/config/runtimeConfig';

/**
 * The API docs page with the integration API spec selected. The docs sit beside `/api/v1`, so an
 * API base that does not end in `/api/v1` gives no link rather than a wrong one.
 */
export function integrationApiDocsUrl(): string | undefined {
  const match = /^(.*\/api)\/v1\/?$/.exec(getSobaApiBaseUrl());
  if (!match) return undefined;
  return `${match[1]}/docs/?urls.primaryName=${encodeURIComponent(INTEGRATION_API_DOCS_NAME)}`;
}
