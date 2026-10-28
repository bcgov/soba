import { sobaFetch } from '@/src/shared/api/sobaFetch';
import { parseJson } from '@/src/shared/api/sobaHelpers';

export interface CredentialMetadata {
  id: string;
  label: string;
  notes: string;
  status: 'issuing' | 'active' | 'rotating' | 'unknown';
  createdAt: string;
  updatedAt: string;
  rotatedAt: string | null;
}
export interface CredentialState {
  available: boolean;
  credential: CredentialMetadata | null;
}
export interface CredentialSecret {
  credential: CredentialMetadata;
  apiKey: string;
}
const path = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}/credentials`;
export const getCredential = async (token: string, workspaceId: string): Promise<CredentialState> =>
  parseJson(await sobaFetch(path(workspaceId), { token }));
export const issueCredential = async (
  token: string,
  workspaceId: string,
): Promise<CredentialSecret> =>
  parseJson(await sobaFetch(path(workspaceId), { token, method: 'POST', json: {} }));
export const regenerateCredential = async (
  token: string,
  workspaceId: string,
  id: string,
): Promise<CredentialSecret> =>
  parseJson(
    await sobaFetch(`${path(workspaceId)}/${encodeURIComponent(id)}/regenerate`, {
      token,
      method: 'POST',
      json: {},
    }),
  );
export const saveCredentialNotes = async (
  token: string,
  workspaceId: string,
  id: string,
  notes: string,
): Promise<CredentialMetadata> =>
  parseJson(
    await sobaFetch(`${path(workspaceId)}/${encodeURIComponent(id)}`, {
      token,
      method: 'PATCH',
      json: { notes },
    }),
  );
