'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button } from 'react-bootstrap';
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
  if (state.status === 'loading') return <p className="text-muted small mb-0">Loading…</p>;
  if (state.status === 'error') {
    return (
      <div className="mt-2">
        <Alert variant="danger" role="alert">
          {state.message}
        </Alert>
      </div>
    );
  }
  if (state.status === 'ok') {
    return (
      <pre
        className="mt-2 border rounded bg-light p-3 small overflow-auto"
        style={{ maxHeight: '28rem' }}
      >
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
    <section className="mb-4 pb-4 border-bottom">
      <h2 className="h5 mb-2">{title}</h2>
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

    const run = async <T,>(
      fn: () => Promise<T>,
    ): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
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
    setFrontendConfig(
      fc.ok ? { status: 'ok', data: fc.data } : { status: 'error', message: fc.message },
    );
    setPlugins(p.ok ? { status: 'ok', data: p.data } : { status: 'error', message: p.message });
    setFormEngines(
      fe.ok ? { status: 'ok', data: fe.data } : { status: 'error', message: fe.message },
    );
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
    return <Alert variant="warning">Missing dictionary keys for this page (metaPage).</Alert>;
  }

  return (
    <div>
      <div className="mb-4 d-flex flex-wrap align-items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => void loadCore()}>
          {labels.refresh}
        </Button>
        <p className="text-muted small mb-0">GET /health, /health/ready, /meta/*</p>
      </div>

      <MetaSection title={labels.sections.health} state={health} />
      <MetaSection title={labels.sections.readiness} state={readiness} />
      <MetaSection title={labels.sections.build} state={build} />
      <MetaSection title={labels.sections.features} state={features} />
      <MetaSection title={labels.sections.frontendConfig} state={frontendConfig} />
      <MetaSection title={labels.sections.plugins} state={plugins} />
      <MetaSection title={labels.sections.formEngines} state={formEngines} />

      <section className="mb-4 pb-4 border-bottom">
        <h2 className="h5 mb-2">{labels.sections.codes}</h2>
        <Button
          type="button"
          variant="secondary"
          className="mb-2"
          onClick={() => void loadCodes()}
          disabled={codes.status === 'loading'}
        >
          {labels.loadCodes}
        </Button>
        <JsonBlock state={codes} />
      </section>

      <section className="mb-4">
        <h2 className="h5 mb-2">{labels.sections.roles}</h2>
        <Button
          type="button"
          variant="secondary"
          className="mb-2"
          onClick={() => void loadRoles()}
          disabled={roles.status === 'loading'}
        >
          {labels.loadRoles}
        </Button>
        <JsonBlock state={roles} />
      </section>
    </div>
  );
}
