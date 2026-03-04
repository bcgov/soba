'use client';

import { useEffect, useState } from 'react';
import { Callout, Heading, InlineAlert, Text } from '@bcgov/design-system-react-components';
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
      <Heading id="workspace-heading" level={2} className="mb-3">
        {dict.header.workspaces}
      </Heading>

      <div className="mb-4" data-testid="backend-status">
        <Callout
          variant="lightGrey"
          title="Backend status"
          description={`Health: ${health}${buildVersion ? ` | Build: ${buildVersion}` : ''}`}
        />
      </div>

      {!authenticated ? (
        <div data-testid="workspace-not-authenticated">
          <InlineAlert variant="warning">{dict.general.notAuthenticated}</InlineAlert>
        </div>
      ) : null}

      {initializing ? (
        <Text data-testid="workspace-auth-initializing">Initializing sign-in...</Text>
      ) : null}

      {authenticated ? (
        <div>
          <Heading level={3} className="mb-2">
            My Workspaces
          </Heading>
          {loading ? (
            <Text data-testid="workspace-loading" aria-live="polite">
              Loading workspaces...
            </Text>
          ) : null}
          {error ? (
            <div data-testid="workspace-error">
              <InlineAlert variant="danger" role="alert">
                {error}
              </InlineAlert>
            </div>
          ) : null}
          {!loading && !error && workspaces.length === 0 ? (
            <Text data-testid="workspace-empty">No workspaces found.</Text>
          ) : null}
          {!loading && !error && workspaces.length > 0 ? (
            <ul data-testid="workspace-list" className="list-disc pl-5">
              {workspaces.map((workspace) => (
                <li key={workspace.id} data-testid={`workspace-item-${workspace.id}`}>
                  <Text elementType="span">
                    <strong>{workspace.name}</strong> ({workspace.kind}) - {workspace.role}
                  </Text>
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
