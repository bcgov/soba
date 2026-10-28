'use client';
import { useState } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { SessionExpiredError } from '@/src/shared/api/sobaFetch';
import * as api from './api';

export function useCredential(
  workspaceId: string,
  demo = process.env.NEXT_PUBLIC_API_KEY_DEMO === 'true',
) {
  const [demoData, setDemoData] = useState<api.CredentialState>({
    available: true,
    credential: null,
  });
  const { token, authenticated, idTokenParsed } = useKeycloak();
  const {
    data: liveData,
    error,
    isLoading,
    mutate,
  } = useAuthedSWR<api.CredentialState>(
    demo ? null : ['workspace-credential', workspaceId, idTokenParsed?.sub],
    (current) => api.getCredential(current, workspaceId),
    { shouldRetryOnError: false },
  );
  const data = demo ? demoData : liveData;
  const requireToken = () => {
    if (!authenticated || !token) {
      throw new SessionExpiredError();
    }
    return token;
  };
  return {
    data,
    demo,
    error: demo ? undefined : error,
    isLoading: demo ? false : isLoading,
    refresh: () => (demo ? Promise.resolve(demoData) : mutate()),
    generate: async () => {
      if (demo) {
        const now = new Date().toISOString();
        const id = demoData.credential?.id ?? crypto.randomUUID();
        const credential: api.CredentialMetadata = {
          id,
          label: id.toUpperCase(),
          notes: demoData.credential?.notes ?? '',
          status: 'active',
          createdAt: demoData.credential?.createdAt ?? now,
          updatedAt: now,
          rotatedAt: demoData.credential ? now : null,
        };
        setDemoData({ available: true, credential });
        return { credential, apiKey: 'fake-api-key-test' };
      }
      try {
        const result = data?.credential
          ? await api.regenerateCredential(requireToken(), workspaceId, data.credential.id)
          : await api.issueCredential(requireToken(), workspaceId);
        // Cache metadata only. The one-time secret goes straight to the dialog's local state.
        await mutate({ available: true, credential: result.credential }, { revalidate: false });
        return result;
      } catch (err) {
        await mutate().catch(() => undefined);
        throw err;
      }
    },
    saveNotes: async (id: string, notes: string) => {
      if (demo) {
        if (demoData.credential?.id !== id) throw new Error('Demo credential not found');
        setDemoData({
          available: true,
          credential: { ...demoData.credential, notes, updatedAt: new Date().toISOString() },
        });
        return;
      }
      const credential = await api.saveCredentialNotes(requireToken(), workspaceId, id, notes);
      await mutate({ available: data?.available ?? false, credential }, { revalidate: false });
    },
  };
}
