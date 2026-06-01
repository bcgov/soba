'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Table } from 'react-bootstrap';
import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { getKeycloakInstance } from '@/lib/slices/keycloakSlice';
import { fetchFormioProxyGet } from '@/src/features/formio-v5/api/formioProxyApi';
import type { FormioV5FormListItem } from '@/src/features/formio-v5/types';

function formDisplayName(f: FormioV5FormListItem): string {
  return f.title?.trim() || f.name?.trim() || f.path?.trim() || f._id;
}

export default function FormioV5FormListClient() {
  const params = useParams();
  const locale = typeof params?.lang === 'string' ? params.lang : 'en';
  const dict = useDictionary();
  const labels = dict.formioV5.formList;
  const { authenticated, refresh } = useKeycloak();

  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ok'; forms: FormioV5FormListItem[] }
    | { status: 'error'; message: string }
  >({ status: 'loading' });

  const load = useCallback(async () => {
    await refresh();
    const token = getKeycloakInstance()?.token;
    if (!token) {
      setState({ status: 'error', message: labels.needLogin });
      return;
    }
    setState({ status: 'loading' });
    const result = await fetchFormioProxyGet<FormioV5FormListItem[]>('/form', token);
    if (!result.ok) {
      setState({
        status: 'error',
        message:
          result.status === 401
            ? labels.unauthorized
            : result.message || `Request failed (${result.status})`,
      });
      return;
    }
    const data = result.data;
    const forms = Array.isArray(data) ? data : [];
    setState({ status: 'ok', forms });
  }, [labels.needLogin, labels.unauthorized, refresh]);

  useEffect(() => {
    if (!authenticated) return;
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [authenticated, load]);

  if (!authenticated) {
    return (
      <div className="mt-3">
        <Alert variant="warning" role="status">
          {labels.needLogin}
        </Alert>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="mt-4">
        <p className="text-muted small">{labels.loading}</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mt-4 d-flex flex-column gap-3">
        <Alert variant="danger" role="alert">
          {state.message}
        </Alert>
        <div>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            {labels.refresh}
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === 'ok' && state.forms.length === 0) {
    return (
      <div className="mt-4 d-flex flex-column gap-3">
        <p className="text-muted small">{labels.empty}</p>
        <div>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            {labels.refresh}
          </Button>
        </div>
      </div>
    );
  }

  if (state.status !== 'ok') {
    return null;
  }

  const { forms } = state;

  return (
    <div className="mt-4">
      <div className="mb-3 d-flex flex-wrap align-items-center gap-3">
        <h2 className="h5 mb-0 fw-semibold">{labels.tableHeading}</h2>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          {labels.refresh}
        </Button>
      </div>
      <div className="overflow-auto border rounded">
        <Table hover bordered responsive className="mb-0 small">
          <thead className="table-light">
            <tr>
              <th>{labels.columns.title}</th>
              <th>{labels.columns.name}</th>
              <th>{labels.columns.path}</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((f: FormioV5FormListItem) => {
              const href = `/${locale}/${encodeURIComponent(f._id)}`;
              const name = formDisplayName(f);
              return (
                <tr key={f._id}>
                  <td>
                    <Link href={href}>{name}</Link>
                  </td>
                  <td className="text-muted">{f.name ?? '—'}</td>
                  <td className="text-muted">{f.path ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
