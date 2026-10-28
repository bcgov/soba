import { extendZodWithOpenApi, type OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
extendZodWithOpenApi(z);

export const WorkspaceCredentialParams = z.object({ id: z.uuid() });
export const CredentialParams = WorkspaceCredentialParams.extend({ credentialId: z.uuid() });
export const CredentialNotesBody = z.strictObject({ notes: z.string().max(1000) });
export const EmptyCredentialBody = z.strictObject({});
export const CredentialMetadataSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  notes: z.string(),
  status: z.enum(['issuing', 'active', 'rotating', 'unknown']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  rotatedAt: z.iso.datetime().nullable(),
});
export const CredentialStateSchema = z.object({
  available: z.boolean(),
  credential: CredentialMetadataSchema.nullable(),
});
export const CredentialSecretSchema = z.object({
  credential: CredentialMetadataSchema,
  apiKey: z.string(),
});

export const registerCredentialsOpenApi = (registry: OpenAPIRegistry): void => {
  const tags = ['Workspace credentials'];
  const errors = {
    400: { description: 'Invalid request' },
    403: { description: 'Workspace owner or admin required' },
    404: { description: 'Workspace or credential not found' },
    409: { description: 'Credential exists, operation pending, or reconciliation required' },
    503: { description: 'Issuer unavailable or operation outcome unknown' },
  };
  registry.registerPath({
    method: 'get',
    path: '/workspaces/{id}/credentials',
    tags,
    security: [{ bearerAuth: [] }],
    request: { params: WorkspaceCredentialParams },
    responses: {
      200: {
        description:
          'Credential metadata only; available indicates configuration, not live upstream health',
        content: { 'application/json': { schema: CredentialStateSchema } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/workspaces/{id}/credentials/{credentialId}',
    tags,
    security: [{ bearerAuth: [] }],
    request: {
      params: CredentialParams,
      body: { content: { 'application/json': { schema: CredentialNotesBody } } },
    },
    responses: {
      200: {
        description: 'Saved credential metadata',
        content: { 'application/json': { schema: CredentialMetadataSchema } },
      },
      ...errors,
    },
  });
  for (const regenerate of [false, true]) {
    registry.registerPath({
      method: 'post',
      path: regenerate
        ? '/workspaces/{id}/credentials/{credentialId}/regenerate'
        : '/workspaces/{id}/credentials',
      tags,
      security: [{ bearerAuth: [] }],
      request: {
        params: regenerate ? CredentialParams : WorkspaceCredentialParams,
        body: { content: { 'application/json': { schema: EmptyCredentialBody } } },
      },
      responses: {
        [regenerate ? 200 : 201]: {
          description: 'API key returned once. Response must not be cached.',
          content: { 'application/json': { schema: CredentialSecretSchema } },
        },
        ...errors,
      },
    });
  }
};
