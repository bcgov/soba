'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button, Heading, InlineAlert, Text } from '@bcgov/design-system-react-components';
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
      <div className="mt-4">
        <InlineAlert variant="warning" role="status">
          {labels.needLogin}
        </InlineAlert>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="mt-6">
        <Text className="text-sm text-[var(--typography-color-secondary)]">{labels.loading}</Text>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mt-6 space-y-3">
        <InlineAlert variant="danger" role="alert">
          {state.message}
        </InlineAlert>
        <Button type="button" onClick={() => void load()}>
          {labels.refresh}
        </Button>
      </div>
    );
  }

  if (state.status === 'ok' && state.forms.length === 0) {
    return (
      <div className="mt-6 space-y-3">
        <Text className="text-sm text-[var(--typography-color-secondary)]">{labels.empty}</Text>
        <Button type="button" onClick={() => void load()}>
          {labels.refresh}
        </Button>
      </div>
    );
  }

  if (state.status !== 'ok') {
    return null;
  }

  const { forms } = state;

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Heading className="text-base font-semibold" level={2}>
          {labels.tableHeading}
        </Heading>
        <Button type="button" onClick={() => void load()}>
          {labels.refresh}
        </Button>
      </div>
      <div className="overflow-x-auto rounded border border-[var(--surface-color-border-default)]">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-color-border-default)] bg-[var(--surface-color-background-subtle)]">
              <th className="px-3 py-2 font-semibold">{labels.columns.title}</th>
              <th className="px-3 py-2 font-semibold">{labels.columns.name}</th>
              <th className="px-3 py-2 font-semibold">{labels.columns.path}</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((f: FormioV5FormListItem) => {
              const href = `/${locale}/forms/${encodeURIComponent(f._id)}`;
              const name = formDisplayName(f);
              return (
                <tr key={f._id} className="border-b border-[var(--surface-color-border-default)] last:border-b-0">
                  <td className="px-3 py-2">
                    <Link className="text-[var(--theme-primary-blue)] underline hover:no-underline" href={href}>
                      {name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[var(--typography-color-secondary)]">{f.name ?? '—'}</td>
                  <td className="px-3 py-2 text-[var(--typography-color-secondary)]">{f.path ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
