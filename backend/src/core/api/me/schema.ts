import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  MeActorSchema as LibMeActorSchema,
  MeProfileSchema as LibMeProfileSchema,
  MePreferencesSchema as LibMePreferencesSchema,
  MeCapabilitiesSchema as LibMeCapabilitiesSchema,
  MeResponseSchema as LibMeResponseSchema,
  PatchMeBodySchema as LibPatchMeBodySchema,
  TenantSchema as LibTenantSchema,
  ListTenantsResponseSchema as LibListTenantsResponseSchema,
  MySubmissionStateSchema as LibMySubmissionStateSchema,
  MySubmissionRoleSchema as LibMySubmissionRoleSchema,
  MySubmissionListItemSchema as LibMySubmissionListItemSchema,
  ListMySubmissionsResponseSchema as LibListMySubmissionsResponseSchema,
} from '@soba/lib';
import {
  offsetQueryFields,
  rejectedCursorField,
  searchQueryField,
  sortLocaleQueryField,
  OffsetPageSchema,
  OFFSET_DRIFT_NOTE,
} from '../shared/offsetPagination';
import { SubmissionSortSchema } from '../submissions/schema';

extendZodWithOpenApi(z);

export const MeActorSchema = LibMeActorSchema.clone().openapi('Me_Actor');
export const MeProfileSchema = LibMeProfileSchema.clone().openapi('Me_Profile');
export const MePreferencesSchema = LibMePreferencesSchema.clone().openapi('Me_Preferences');
export const MeCapabilitiesSchema = LibMeCapabilitiesSchema.clone().openapi('Me_Capabilities');

export const MeResponseSchema = LibMeResponseSchema.extend({
  actor: MeActorSchema,
  profile: MeProfileSchema,
  preferences: MePreferencesSchema,
  capabilities: MeCapabilitiesSchema,
}).openapi('Me_Response');

export const PatchMeBodySchema = LibPatchMeBodySchema.extend({
  preferences: MePreferencesSchema,
}).openapi('Me_PatchBody');

export const MeTenantSchema = LibTenantSchema.clone().openapi('Me_Tenant');

export const MeTenantsResponseSchema = LibListTenantsResponseSchema.extend({
  tenants: z.array(MeTenantSchema),
}).openapi('Me_TenantsResponse');

export const MySubmissionStateSchema =
  LibMySubmissionStateSchema.clone().openapi('Me_SubmissionState');

export const ListMySubmissionsQuerySchema = z
  .object({
    ...offsetQueryFields,
    cursor: rejectedCursorField,
    workflowState: MySubmissionStateSchema.optional(),
    q: searchQueryField.openapi({
      description: 'Matches anywhere in the form name, or a submitted confirmation code.',
    }),
    sort: SubmissionSortSchema.default('updatedAt:desc'),
    locale: sortLocaleQueryField,
  })
  .openapi('Me_ListSubmissionsQuery');

export const MySubmissionRoleSchema =
  LibMySubmissionRoleSchema.clone().openapi('Me_SubmissionRole');

export const MySubmissionListItemSchema = LibMySubmissionListItemSchema.extend({
  workflowState: MySubmissionStateSchema,
  role: MySubmissionRoleSchema,
}).openapi('Me_SubmissionListItem');

export const ListMySubmissionsResponseSchema = LibListMySubmissionsResponseSchema.extend({
  items: z.array(MySubmissionListItemSchema),
  page: OffsetPageSchema,
  filters: z.object({
    workflowState: MySubmissionStateSchema.optional(),
    q: z.string().optional(),
  }),
  sort: SubmissionSortSchema,
}).openapi('Me_ListSubmissionsResponse');

export const registerMeOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/me',
    tags: ['core.me'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Current authenticated actor with backend-resolved profile fields',
        content: {
          'application/json': {
            schema: MeResponseSchema,
          },
        },
      },
      404: {
        description: 'Current actor not found',
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/me',
    tags: ['core.me'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: PatchMeBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated current actor preferences',
        content: {
          'application/json': {
            schema: MeResponseSchema,
          },
        },
      },
      400: {
        description: 'Invalid request body',
      },
      403: {
        description: 'Not a member of the requested workspace',
      },
      404: {
        description: 'Current actor not found',
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/me/tenants',
    tags: ['core.me'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description:
          "The caller's tenants from the default tenant engine; empty when the engine does not serve the caller's identity provider",
        content: {
          'application/json': {
            schema: MeTenantsResponseSchema,
          },
        },
      },
      400: {
        description: 'Missing actor identity or bearer token',
      },
      503: {
        description: 'The tenant engine is unavailable',
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/me/submissions',
    tags: ['core.me'],
    security: [{ bearerAuth: [] }],
    description: `The caller's draft and submitted submissions, across every workspace. ${OFFSET_DRIFT_NOTE}`,
    request: { query: ListMySubmissionsQuerySchema },
    responses: {
      200: {
        description: "A page of the caller's submissions",
        content: {
          'application/json': {
            schema: ListMySubmissionsResponseSchema,
          },
        },
      },
      400: {
        description: 'Invalid query',
      },
      404: {
        description: 'Submit mode is not enabled',
      },
    },
  });
};
