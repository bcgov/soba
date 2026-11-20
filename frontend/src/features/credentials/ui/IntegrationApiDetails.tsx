'use client';

import { Link } from '@bcgov/design-system-react-components';
import type { Dictionary } from '@/src/types/dictionary';
import { integrationApiDocsUrl } from '../data/integrationApiDocs';

/** Where a key is used: the integration API address, the header that carries it, and the docs. */
export function IntegrationApiDetails({ dict, url }: Readonly<{ dict: Dictionary; url: string }>) {
  const t = dict.apiKeys;
  const docsUrl = integrationApiDocsUrl();
  return (
    <div className="d-flex flex-column gap-1" data-testid="api-key-integration-api">
      <p className="m-0">
        {t.integrationApiLabel} <code data-testid="api-key-integration-url">{url}</code>
      </p>
      <p className="m-0">{t.integrationApiHeader}</p>
      {docsUrl && (
        <p className="m-0">
          <Link
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="api-key-integration-docs"
          >
            {t.integrationApiDocs}
          </Link>
        </p>
      )}
    </div>
  );
}
