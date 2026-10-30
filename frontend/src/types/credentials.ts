export type {
  CreateCredential,
  CredentialMetadata,
  CredentialSecret,
  CredentialState,
} from '@soba/lib';

export type CredentialScope = { kind: 'workspace' | 'form'; id: string };
