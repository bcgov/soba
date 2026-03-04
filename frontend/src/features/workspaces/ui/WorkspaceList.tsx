'use client';

import { useEffect, useState } from 'react';
import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/useKeycloak';
import { fetchBuildMeta, fetchHealth, fetchWorkspaces, WorkspaceItem } from '@/src/shared/api/sobaApi';

function WorkspaceList() {
  const dict = useDictionary();
  const { authenticated, token, initializing } = useKeycloak();
  const [health, setHealth] = useState<string>('unknown');
  const [buildVersion, setBuildVersion] = useState<string>('');
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const loadPublicMetadata = async () => {
      try {
        const [healthResponse, build] = await Promise.all([fetchHealth(), fetchBuildMeta()]);
        if (cancelled) return;
        setHealth(healthResponse.status);
        setBuildVersion(build.version);
      } catch {
        if (cancelled) return;
        setHealth('unreachable');
      }
    };
    loadPublicMetadata();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authenticated || !token) return;
    let cancelled = false;
    const loadWorkspaces = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchWorkspaces(token);
        if (!cancelled) setWorkspaces(response.items);
      } catch (err: unknown) {
        if (!cancelled) setError((err as { message?: string })?.message ?? 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, [authenticated, token]);

  return (
    <section className="p-4" data-testid="workspace-page" aria-labelledby="workspace-heading">
      <h2 id="workspace-heading" className="text-xl font-semibold mb-3">
        {dict.header.workspaces}
      </h2>

      <div className="mb-4 card-surface p-3 rounded" data-testid="backend-status" aria-live="polite">
        <h3 className="text-lg font-semibold">Backend status</h3>
        <p>Health: {health}</p>
        {buildVersion ? <p>Build: {buildVersion}</p> : null}
      </div>

      {!authenticated ? (
        <p data-testid="workspace-not-authenticated">{dict.general.notAuthenticated}</p>
      ) : null}

      {initializing ? <p data-testid="workspace-auth-initializing">Initializing sign-in...</p> : null}

      {authenticated ? (
        <div>
          <h3 className="text-lg font-semibold mb-2">My Workspaces</h3>
          {loading ? (
            <p data-testid="workspace-loading" aria-live="polite">
              Loading workspaces...
            </p>
          ) : null}
          {error ? (
            <p data-testid="workspace-error" className="text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && workspaces.length === 0 ? (
            <p data-testid="workspace-empty">No workspaces found.</p>
          ) : null}
          {!loading && !error && workspaces.length > 0 ? (
            <ul data-testid="workspace-list" className="list-disc pl-5">
              {workspaces.map((workspace) => (
                <li key={workspace.id} data-testid={`workspace-item-${workspace.id}`}>
                  <strong>{workspace.name}</strong> ({workspace.kind}) - {workspace.role}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default WorkspaceList;
