'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, Heading, InlineAlert, Text } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import {
  fetchBuildMeta,
  fetchCodesMeta,
  fetchFeaturesMeta,
  fetchFormEnginesMeta,
  fetchFrontendConfigMeta,
  fetchHealth,
  fetchHealthReady,
  fetchPluginsMeta,
  fetchRolesMeta,
} from '@/src/shared/api/sobaApi';

type SectionState =
  | { status: 'idle' | 'loading' }
  | { status: 'ok'; data: unknown }
  | { status: 'error'; message: string };

const initialSection: SectionState = { status: 'idle' };

function formatJson(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function JsonBlock({ state }: { state: SectionState }) {
  if (state.status === 'loading') return <Text>Loading…</Text>;
  if (state.status === 'error') {
    return (
      <div className="mt-2">
        <InlineAlert variant="danger" role="alert">
          {state.message}
        </InlineAlert>
      </div>
    );
  }
  if (state.status === 'ok') {
    return (
      <pre className="mt-2 max-h-[28rem] overflow-auto rounded border border-[var(--surface-color-border-default)] bg-[var(--surface-color-background-subtle)] p-3 text-xs">
        {formatJson(state.data)}
      </pre>
    );
  }
  return null;
}

function MetaSection({
  title,
  state,
  children,
}: {
  title: string;
  state: SectionState;
  children?: ReactNode;
}) {
  return (
    <section className="mb-8 border-b border-[var(--surface-color-border-default)] pb-6 last:mb-0 last:border-b-0">
      <Heading className="mb-2">{title}</Heading>
      {children}
      <JsonBlock state={state} />
    </section>
  );
}

export default function MetaReviewClient() {
  const dict = useDictionary();
  const labels = dict.metaPage;

  const [health, setHealth] = useState<SectionState>(initialSection);
  const [readiness, setReadiness] = useState<SectionState>(initialSection);
  const [build, setBuild] = useState<SectionState>(initialSection);
  const [features, setFeatures] = useState<SectionState>(initialSection);
  const [frontendConfig, setFrontendConfig] = useState<SectionState>(initialSection);
  const [plugins, setPlugins] = useState<SectionState>(initialSection);
  const [formEngines, setFormEngines] = useState<SectionState>(initialSection);
  const [codes, setCodes] = useState<SectionState>(initialSection);
  const [roles, setRoles] = useState<SectionState>(initialSection);

  const loadCore = useCallback(async () => {
    setHealth({ status: 'loading' });
    setReadiness({ status: 'loading' });
    setBuild({ status: 'loading' });
    setFeatures({ status: 'loading' });
    setFrontendConfig({ status: 'loading' });
    setPlugins({ status: 'loading' });
    setFormEngines({ status: 'loading' });

    const run = async <T,>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
      try {
        const data = await fn();
        return { ok: true, data };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Request failed';
        return { ok: false, message };
      }
    };

    const [h, r, b, f, fc, p, fe] = await Promise.all([
      run(() => fetchHealth()),
      run(() => fetchHealthReady()),
      run(() => fetchBuildMeta()),
      run(() => fetchFeaturesMeta()),
      run(() => fetchFrontendConfigMeta()),
      run(() => fetchPluginsMeta()),
      run(() => fetchFormEnginesMeta()),
    ]);

    setHealth(h.ok ? { status: 'ok', data: h.data } : { status: 'error', message: h.message });
    if (r.ok) {
      setReadiness({
        status: 'ok',
        data: { httpStatus: r.data.status, body: r.data.body },
      });
    } else {
      setReadiness({ status: 'error', message: r.message });
    }
    setBuild(b.ok ? { status: 'ok', data: b.data } : { status: 'error', message: b.message });
    setFeatures(f.ok ? { status: 'ok', data: f.data } : { status: 'error', message: f.message });
    setFrontendConfig(fc.ok ? { status: 'ok', data: fc.data } : { status: 'error', message: fc.message });
    setPlugins(p.ok ? { status: 'ok', data: p.data } : { status: 'error', message: p.message });
    setFormEngines(fe.ok ? { status: 'ok', data: fe.data } : { status: 'error', message: fe.message });
  }, []);

  useEffect(() => {
    // Schedule outside the effect flush: react-hooks/set-state-in-effect forbids calling loadCore()
    // directly here because it updates many useStates synchronously at the start of the async fn.
    const id = window.setTimeout(() => {
      void loadCore();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadCore]);

  const loadCodes = useCallback(async () => {
    setCodes({ status: 'loading' });
    try {
      const data = await fetchCodesMeta(true);
      setCodes({ status: 'ok', data });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Request failed';
      setCodes({ status: 'error', message });
    }
  }, []);

  const loadRoles = useCallback(async () => {
    setRoles({ status: 'loading' });
    try {
      const data = await fetchRolesMeta(true);
      setRoles({ status: 'ok', data });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Request failed';
      setRoles({ status: 'error', message });
    }
  }, []);

  if (!labels) {
    return (
      <InlineAlert variant="warning">
        Missing dictionary keys for this page (metaPage).
      </InlineAlert>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void loadCore()}>
          {labels.refresh}
        </Button>
        <Text className="text-sm text-[var(--typography-color-secondary)]">
          GET /health, /health/ready, /meta/*
        </Text>
      </div>

      <MetaSection title={labels.sections.health} state={health} />
      <MetaSection title={labels.sections.readiness} state={readiness} />
      <MetaSection title={labels.sections.build} state={build} />
      <MetaSection title={labels.sections.features} state={features} />
      <MetaSection title={labels.sections.frontendConfig} state={frontendConfig} />
      <MetaSection title={labels.sections.plugins} state={plugins} />
      <MetaSection title={labels.sections.formEngines} state={formEngines} />

      <section className="mb-8 border-b border-[var(--surface-color-border-default)] pb-6">
        <Heading className="mb-2">{labels.sections.codes}</Heading>
        <Button
          type="button"
          className="mb-2"
          onClick={() => void loadCodes()}
          isDisabled={codes.status === 'loading'}
        >
          {labels.loadCodes}
        </Button>
        <JsonBlock state={codes} />
      </section>

      <section className="mb-8">
        <Heading className="mb-2">{labels.sections.roles}</Heading>
        <Button
          type="button"
          className="mb-2"
          onClick={() => void loadRoles()}
          isDisabled={roles.status === 'loading'}
        >
          {labels.loadRoles}
        </Button>
        <JsonBlock state={roles} />
      </section>
    </div>
  );
}
