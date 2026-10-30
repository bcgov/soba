'use client';

import { useState } from 'react';
import { Button } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { DataTable } from '@/src/components/DataTable';
import { ListPageSearchField } from '@/src/components/ListPageSearchField';
import { useFormatLongDateTime } from '@/src/shared/hooks/useFormatLongDate';
import { CREDENTIALS_LIST_QUERY } from '@/src/shared/list/listQueryMemory';
import { useListQuery } from '@/src/shared/list/useListQuery';
import { messageForDataError } from '@/src/shared/api/dataError';
import { useCredentialWriter, useCredentials } from '../data/useCredentials';
import type {
  CredentialMetadata,
  CredentialSecret,
  CredentialScope,
} from '@/src/types/credentials';
import { CreateApiKeyForm } from './CreateApiKeyForm';
import { ApiKeySecretDialog } from './ApiKeySecretDialog';

function ApiKeySection({ scope }: Readonly<{ scope: CredentialScope }>) {
  const dict = useDictionary();
  const t = dict.apiKeys;
  const formatDate = useFormatLongDateTime();
  const listQuery = useListQuery(CREDENTIALS_LIST_QUERY);
  const resource = useCredentials(scope, {
    offset: listQuery.offset,
    limit: listQuery.pageSize,
    sort: listQuery.sort,
    q: listQuery.q,
  });
  const writer = useCredentialWriter(scope);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<CredentialSecret | null>(null);
  const pending = resource.data?.items.some((item) => item.status !== 'active') ?? false;
  const error = resource.error
    ? messageForDataError(resource.error, {
        failed: t.loadError,
        forbidden: t.forbidden,
        sessionExpired: t.sessionExpired,
      })
    : null;
  return (
    <section aria-label={t.heading} data-testid="api-keys-section">
      {resource.data && !resource.data.available && (
        <p role="status" data-testid="api-key-unavailable">
          {t.unavailable}
        </p>
      )}
      <ListPageSearchField
        value={listQuery.searchInput}
        onChange={listQuery.setSearchInput}
        onSubmit={listQuery.commitSearch}
        testIdPrefix="api-keys"
      />
      <div data-testid="api-keys-table">
        <DataTable<CredentialMetadata>
          data={resource.data?.items ?? []}
          loading={resource.isLoading}
          loadingMessage={dict.general.loading}
          error={error}
          emptyMessage={t.empty}
          caption={t.heading}
          currentPage={listQuery.page}
          pageSize={listQuery.pageSize}
          totalItems={resource.data?.page.total}
          onPageChange={listQuery.setPage}
          onPageSizeChange={listQuery.setPageSize}
          sort={listQuery.sort}
          onSortChange={listQuery.setSort}
          keyExtractor={(item) => item.id}
          columns={[
            {
              key: 'createdAt',
              label: t.createdAt,
              sortField: 'createdAt',
              sortDefaultDirection: 'desc',
              render: (item) => formatDate(item.createdAt),
            },
            {
              key: 'label',
              label: t.label,
              sortField: 'label',
              render: (item) => <span data-testid={`api-key-item-${item.id}`}>{item.label}</span>,
            },
            { key: 'notes', label: t.notes },
            {
              key: 'types',
              label: t.types,
              render: (item) =>
                item.types
                  .map((type) => (type === 'api' ? t.apiAccess : t.webComponents))
                  .join(', '),
            },
            {
              key: 'status',
              sortField: 'status',
              label: t.status,
              render: (item) => (item.status === 'active' ? t.active : t.pending),
            },
          ]}
        />
      </div>
      {(resource.error || pending) && (
        <Button
          variant="secondary"
          data-testid="api-key-refresh"
          onPress={() => void resource.refresh().catch(() => undefined)}
        >
          {t.refresh}
        </Button>
      )}
      {!adding && (
        <Button
          variant="primary"
          data-testid="api-key-add"
          isDisabled={resource.isLoading || !!resource.error || !resource.data?.available}
          onPress={() => setAdding(true)}
        >
          {t.add}
        </Button>
      )}
      {adding && (
        <CreateApiKeyForm
          dict={dict}
          generate={writer.generate}
          onCancel={() => setAdding(false)}
          onCreated={(result) => {
            setAdding(false);
            setSecret(result);
          }}
        />
      )}
      {secret && <ApiKeySecretDialog dict={dict} secret={secret} onDone={() => setSecret(null)} />}
    </section>
  );
}

export default function ApiKeys({ scope }: Readonly<{ scope: CredentialScope }>) {
  const { authenticated, idTokenParsed } = useKeycloak();
  if (!authenticated) return null;
  // Workspace/session changes discard the one-time secret; token refreshes do not.
  return (
    <ApiKeySection key={`${scope.kind}:${scope.id}:${idTokenParsed?.sub ?? ''}`} scope={scope} />
  );
}
