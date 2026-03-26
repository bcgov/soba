'use client';

/**
 * TEMP(submit-demo): SOBA form list + one-click demo provisioning for the Submit page.
 * Delete this file with the rest of `submit-demo-temp` when obsolete.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button, Heading, InlineAlert, Text } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { getKeycloakInstance } from '@/lib/slices/keycloakSlice';
import { resolveSubmitDemoWorkspaceId } from './resolveSubmitDemoWorkspace';
import {
  createForm,
  createFormVersionDraft,
  fetchWorkspacesForSubmitDemo,
  getFormVersion,
  listForms,
  listFormVersionsForForm,
  saveFormVersionWithProvision,
  type SubmitDemoFormListItem,
  type SubmitDemoFormVersionListItem,
} from './submitDemoApi';
import { SUBMIT_DEMO_FUN_FORM_DEFINITION } from './submitDemoFunFormDefinition';

type Row = { form: SubmitDemoFormListItem; latestVersion: SubmitDemoFormVersionListItem | null };

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; workspaceId: string; rows: Row[] };

function syncLabel(
  status: string,
  labels: { pending: string; provisioning: string; ready: string; failed: string },
): string {
  if (status === 'ready') return labels.ready;
  if (status === 'provisioning') return labels.provisioning;
  if (status === 'failed') return labels.failed;
  return labels.pending;
}

/** TEMP(submit-demo): generator always creates SOBA form with display name `Fun`. */
function hasFunForm(rows: Row[]): boolean {
  return rows.some((r) => r.form.name.trim() === 'Fun');
}

export default function SubmitDemoTempPanel() {
  const params = useParams();
  const locale = typeof params?.lang === 'string' ? params.lang : 'en';
  const dict = useDictionary();
  const labels = dict.submitDemo;
  const { authenticated, refresh } = useKeycloak();
  const tokenReady = authenticated && !!getKeycloakInstance()?.token;

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    await refresh();
    const token = getKeycloakInstance()?.token;
    if (!token) {
      setLoadState({ status: 'error', message: labels.needLogin });
      return;
    }
    setLoadState({ status: 'loading' });
    try {
      const ws = await fetchWorkspacesForSubmitDemo(token);
      const workspaceId = resolveSubmitDemoWorkspaceId(ws.items);
      if (!workspaceId) {
        setLoadState({ status: 'error', message: labels.noWorkspace });
        return;
      }
      const formsRes = await listForms(token, workspaceId);
      const rows: Row[] = await Promise.all(
        formsRes.items.map(async (form) => {
          try {
            const v = await listFormVersionsForForm(token, workspaceId, form.id);
            return { form, latestVersion: v.items[0] ?? null };
          } catch {
            return { form, latestVersion: null };
          }
        }),
      );
      setLoadState({ status: 'ok', workspaceId, rows });
    } catch (e) {
      setLoadState({
        status: 'error',
        message: e instanceof Error ? e.message : labels.loadError,
      });
    }
  }, [labels.loadError, labels.needLogin, labels.noWorkspace, refresh]);

  useEffect(() => {
    if (!authenticated) return;
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [authenticated, load]);

  const runGenerate = useCallback(async () => {
    if (loadState.status !== 'ok') return;
    await refresh();
    const token = getKeycloakInstance()?.token;
    if (!token) return;
    const { workspaceId } = loadState;
    setGenerating(true);
    try {
      const slug = `fun-demo-${crypto.randomUUID().slice(0, 8)}`;
      const createdForm = await createForm(token, workspaceId, {
        slug,
        name: 'Fun',
        formEngineCode: 'formio-v5',
      });
      const draft = await createFormVersionDraft(token, workspaceId, createdForm.id);
      await saveFormVersionWithProvision(token, workspaceId, draft.id, SUBMIT_DEMO_FUN_FORM_DEFINITION);

      const deadline = Date.now() + 60_000;
      let status = 'pending';
      while (Date.now() < deadline) {
        const v = await getFormVersion(token, workspaceId, draft.id);
        status = v.engineSyncStatus;
        if (status === 'ready' || status === 'failed') break;
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (status !== 'ready' && status !== 'failed') {
        setLoadState({
          status: 'error',
          message: labels.pollTimeout,
        });
        setGenerating(false);
        return;
      }
      await load();
    } catch (e) {
      setLoadState({
        status: 'error',
        message: e instanceof Error ? e.message : labels.generateError,
      });
    } finally {
      setGenerating(false);
    }
  }, [load, loadState, labels.generateError, labels.pollTimeout, refresh]);

  if (!authenticated) {
    return (
      <div className="mt-4">
        <InlineAlert variant="warning" role="status">
          {labels.needLogin}
        </InlineAlert>
      </div>
    );
  }

  if (loadState.status === 'loading') {
    return (
      <div className="mt-6">
        <Text className="text-sm text-[var(--typography-color-secondary)]">{labels.loading}</Text>
      </div>
    );
  }

  if (loadState.status === 'error') {
    return (
      <div className="mt-6 space-y-3">
        <InlineAlert variant="danger" role="alert">
          {loadState.message}
        </InlineAlert>
        {tokenReady ? (
          <Button type="button" onClick={() => void load()}>
            {labels.refresh}
          </Button>
        ) : null}
      </div>
    );
  }

  const { rows } = loadState;
  const showGenerate = !hasFunForm(rows);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Heading className="text-base font-semibold" level={2}>
          {labels.tableHeading}
        </Heading>
        {tokenReady ? (
          <Button type="button" onClick={() => void load()} isDisabled={generating}>
            {labels.refresh}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="space-y-3">
          <Text className="text-sm text-[var(--typography-color-secondary)]">{labels.empty}</Text>
          {tokenReady ? (
            <Button type="button" onClick={() => void runGenerate()} isDisabled={generating}>
              {generating ? labels.generating : labels.generate}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-[var(--surface-color-border-default)]">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-color-border-default)] bg-[var(--surface-color-background-subtle)]">
                  <th className="px-3 py-2 font-semibold">{labels.columns.name}</th>
                  <th className="px-3 py-2 font-semibold">{labels.columns.slug}</th>
                  <th className="px-3 py-2 font-semibold">{labels.columns.sync}</th>
                  <th className="px-3 py-2 font-semibold">{labels.columns.open}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ form, latestVersion }) => {
                  const sync = latestVersion?.engineSyncStatus ?? '—';
                  const ref = latestVersion?.engineSchemaRef;
                  const href =
                    ref && ref.length > 0 ? `/${locale}/forms/${encodeURIComponent(ref)}` : null;
                  return (
                    <tr
                      key={form.id}
                      className="border-b border-[var(--surface-color-border-default)] last:border-b-0"
                    >
                      <td className="px-3 py-2">{form.name}</td>
                      <td className="px-3 py-2 text-[var(--typography-color-secondary)]">{form.slug}</td>
                      <td className="px-3 py-2 text-[var(--typography-color-secondary)]">
                        {latestVersion
                          ? syncLabel(sync, {
                              pending: labels.syncPending,
                              provisioning: labels.syncProvisioning,
                              ready: labels.syncReady,
                              failed: labels.syncFailed,
                            })
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {href ? (
                          <Link
                            className="text-[var(--theme-primary-blue)] underline hover:no-underline"
                            href={href}
                          >
                            {labels.openForm}
                          </Link>
                        ) : (
                          <span className="text-[var(--typography-color-secondary)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tokenReady && showGenerate ? (
            <Button type="button" onClick={() => void runGenerate()} isDisabled={generating}>
              {generating ? labels.generating : labels.generate}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
