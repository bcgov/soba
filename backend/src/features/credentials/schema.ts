import {
  CreateCredentialSchema as LibCreateCredentialSchema,
  CredentialMetadataSchema as LibCredentialMetadataSchema,
  CredentialStateSchema as LibCredentialStateSchema,
  CredentialSecretSchema as LibCredentialSecretSchema,
  CREDENTIAL_SORT_FIELDS,
  makeSortEnum,
  type SortLocale,
} from '@soba/lib';
import { extendZodWithOpenApi, type OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  offsetQueryFields,
  rejectedCursorField,
  searchQueryField,
  sortLocaleQueryField,
  OffsetPageSchema,
} from '../../core/api/shared/offsetPagination';
extendZodWithOpenApi(z);

export const CreateCredentialSchema = LibCreateCredentialSchema.clone().openapi(
  'Credentials_CreateCredential',
);
export const CredentialMetadataSchema = LibCredentialMetadataSchema.clone().openapi(
  'Credentials_CredentialMetadata',
);
export const CredentialSortSchema = makeSortEnum(CREDENTIAL_SORT_FIELDS).openapi(
  'Credentials_CredentialSort',
);
export const CredentialStateSchema = LibCredentialStateSchema.extend({
  items: z.array(CredentialMetadataSchema),
  page: OffsetPageSchema,
  sort: CredentialSortSchema,
}).openapi('Credentials_CredentialState');
export const CredentialSecretSchema = LibCredentialSecretSchema.extend({
  credential: CredentialMetadataSchema,
}).openapi('Credentials_CredentialSecret');
export const ListCredentialsQuerySchema = z
  .object({
    ...offsetQueryFields,
    cursor: rejectedCursorField,
    q: searchQueryField,
    sort: CredentialSortSchema.default('createdAt:desc'),
    locale: sortLocaleQueryField,
  })
  .openapi('Credentials_ListCredentialsQuery');
export type CredentialListQuery = Omit<z.infer<typeof ListCredentialsQuerySchema>, 'locale'> & {
  locale: SortLocale;
};

export const WorkspaceCredentialParams = z.object({ id: z.uuid() });
export const CredentialParams = WorkspaceCredentialParams.extend({ credentialId: z.uuid() });
export const CredentialNotesBody = z.strictObject({ notes: z.string().max(1000) });
export type CredentialNotesInput = z.infer<typeof CredentialNotesBody>;
export const EmptyCredentialBody = z.strictObject({});
export const registerCredentialsOpenApi = (registry: OpenAPIRegistry): void => {
  const tags = ['API credentials'];
  const errors = {
    400: { description: 'Invalid request' },
    403: { description: 'Workspace owner or admin required' },
    404: { description: 'Workspace, form or credential not found' },
    409: { description: 'Operation pending or reconciliation required' },
    503: { description: 'Issuer unavailable or operation outcome unknown' },
  };
  registry.registerPath({
    method: 'get',
    path: '/design/forms/{id}/credentials',
    tags,
    security: [{ bearerAuth: [] }],
    request: { params: WorkspaceCredentialParams, query: ListCredentialsQuerySchema },
    responses: {
      200: {
        description:
          'Credentials created for this form; workspace credentials are listed separately',
        content: { 'application/json': { schema: CredentialStateSchema } },
      },
      ...errors,
      403: { description: 'Form update permission required' },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/design/forms/{id}/credentials',
    tags,
    security: [{ bearerAuth: [] }],
    request: {
      params: WorkspaceCredentialParams,
      body: { content: { 'application/json': { schema: CreateCredentialSchema } } },
    },
    responses: {
      201: {
        description: 'Form API key returned once; must not be cached',
        content: { 'application/json': { schema: CredentialSecretSchema } },
      },
      ...errors,
      403: { description: 'Form update permission required' },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/workspaces/{id}/credentials',
    tags,
    security: [{ bearerAuth: [] }],
    request: { params: WorkspaceCredentialParams, query: ListCredentialsQuerySchema },
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
        body: {
          content: {
            'application/json': {
              schema: regenerate ? EmptyCredentialBody : CreateCredentialSchema,
            },
          },
        },
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
