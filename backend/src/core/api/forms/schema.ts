import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  CreateFormBodySchema as SobaCreateFormBodySchema,
  FormVersionResponseSchema as SobaFormVersionResponseSchema,
  FormVersionListItemSchema as SobaFormVersionListItemSchema,
  FormResponseSchema as SobaFormResponseSchema,
  UpdateFormBodySchema as SobaUpdateFormBodySchema,
  FormWithPermissionsResponseSchema as SobaFormWithPermissionsResponseSchema,
  FormListItemSchema as SobaFormListItemSchema,
  ListFormsResponseSchema as SobaListFormsResponseSchema,
  FormSortSchema as SobaFormSortSchema,
  FormVersionSortSchema as SobaFormVersionSortSchema,
  ListFormVersionsResponseSchema as SobaListFormVersionsResponseSchema,
  FormVersionSummarySchema as SobaFormVersionSummarySchema,
  FormVersionLookupResponseSchema as SobaFormVersionLookupResponseSchema,
  FormSubmitterAudienceSchema as SobaFormSubmitterAudienceSchema,
  SetFormSubmitterAudienceBodySchema as SobaSetFormSubmitterAudienceBodySchema,
} from '@soba/lib';
import { LOOKUP_NOTE } from '../shared/lookup';

import {
  offsetQueryFields,
  rejectedCursorField,
  searchQueryField,
  OffsetPageSchema,
  OFFSET_DRIFT_NOTE,
  sortLocaleQueryField,
  SortLocaleQuerySchema,
} from '../shared/offsetPagination';
import { FORM_NAME_TAKEN } from '../../messages';
import {
  workspaceIdQueryField,
  formIdQueryField,
  formVersionIdQueryField,
  WorkspaceScopedQuerySchema,
} from '../shared/schema';

extendZodWithOpenApi(z);

// @soba/lib builds its schemas before zod is extended, so they only get `.openapi()` once cloned.
// Composites are rebuilt on the named children so the spec references them instead of inlining.
export const CreateFormBodySchema =
  SobaCreateFormBodySchema.clone().openapi('Forms_CreateFormBody');
export const UpdateFormBodySchema =
  SobaUpdateFormBodySchema.clone().openapi('Forms_UpdateFormBody');
export const FormListItemSchema = SobaFormListItemSchema.clone().openapi('Forms_FormListItem');
export const FormResponseSchema = SobaFormResponseSchema.clone().openapi('Forms_FormResponse');
export const FormVersionResponseSchema = SobaFormVersionResponseSchema.clone().openapi(
  'Forms_FormVersionResponse',
);
export const FormWithVersionResponseSchema = FormResponseSchema.extend({
  formVersion: FormVersionResponseSchema.nullable(),
}).openapi('Forms_FormWithVersionResponse');
export const FormVersionSummarySchema = SobaFormVersionSummarySchema.clone().openapi(
  'Forms_FormVersionSummary',
);
export const FormWithPermissionsResponseSchema = FormResponseSchema.extend({
  permissions: SobaFormWithPermissionsResponseSchema.shape.permissions,
  currentVersion: FormVersionSummarySchema.nullable().openapi({
    description:
      'The highest-numbered version that is not deleted. Save and publish target this one.',
  }),
}).openapi('Forms_FormWithPermissionsResponse');
export const FormVersionListItemSchema = SobaFormVersionListItemSchema.clone().openapi(
  'Forms_FormVersionListItem',
);

export const CreateFormVersionBodySchema = z
  .object({
    formId: z.string().min(1),
    fromFormVersionId: z.uuid().optional().openapi({
      description:
        'The version of this form the draft starts from. The draft gets its document templates.',
    }),
  })
  .openapi('Forms_CreateFormVersionBody');

export const FormIdParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Forms_FormIdParams');

export const SetFormSubmitterAudienceBodySchema =
  SobaSetFormSubmitterAudienceBodySchema.clone().openapi('Forms_SetFormSubmitterAudienceBody');
export const FormSubmitterAudienceSchema = SobaFormSubmitterAudienceSchema.clone().openapi(
  'Forms_FormSubmitterAudience',
);

export const FormVersionIdParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Forms_FormVersionIdParams');

export const SaveFormVersionParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Forms_SaveFormVersionParams');

export const SaveFormVersionBodySchema = z
  .object({
    eventType: z.string().min(1).optional(),
    note: z.string().optional(),
    formioFormDefinition: z.record(z.string(), z.unknown()).optional(),
    engine_schema_ref: z.string().min(1).optional(),
  })
  .openapi('Forms_SaveFormVersionBody');

export const ProvisionSchemaBodySchema = z
  .object({
    schema: z.record(z.string(), z.unknown()),
  })
  .openapi('Forms_ProvisionSchemaBody');

export const NormalizeSchemaBodySchema = z
  .object({
    schema: z.record(z.string(), z.unknown()),
  })
  .openapi('Forms_NormalizeSchemaBody');

export const NormalizeSchemaResponseSchema = z
  .object({
    schema: z.record(z.string(), z.unknown()),
  })
  .openapi('Forms_NormalizeSchemaResponse');

export const FormSortSchema = SobaFormSortSchema.clone().openapi('Forms_FormSort');

export const ListFormsQuerySchema = z
  .object({
    workspaceId: workspaceIdQueryField.optional(),
    formId: formIdQueryField,
    ...offsetQueryFields,
    cursor: rejectedCursorField,
    q: searchQueryField.openapi({ description: 'Matches anywhere in the form name.' }),
    status: z.string().trim().min(1).optional(),
    sort: FormSortSchema.default('createdAt:desc'),
    locale: sortLocaleQueryField,
  })
  .openapi('Forms_ListFormsQuery');

export const ListFormsResponseSchema = SobaListFormsResponseSchema.extend({
  items: z.array(FormListItemSchema),
  page: OffsetPageSchema,
  sort: FormSortSchema,
}).openapi('Forms_ListFormsResponse');

export const FormVersionSortSchema =
  SobaFormVersionSortSchema.clone().openapi('Forms_FormVersionSort');

export const ListFormVersionsQuerySchema = z
  .object({
    workspaceId: workspaceIdQueryField.optional(),
    formId: formIdQueryField,
    formVersionId: formVersionIdQueryField,
    ...offsetQueryFields,
    cursor: rejectedCursorField,
    state: z.string().trim().min(1).optional(),
    sort: FormVersionSortSchema.default('versionNo:desc'),
  })
  .openapi('Forms_ListFormVersionsQuery');

export const ListFormVersionsResponseSchema = SobaListFormVersionsResponseSchema.extend({
  items: z.array(FormVersionListItemSchema),
  page: OffsetPageSchema,
  sort: FormVersionSortSchema,
}).openapi('Forms_ListFormVersionsResponse');

export const FormVersionLookupQuerySchema = z
  .object({
    formId: z.string().min(1).openapi({
      description: 'The form whose versions are returned. Workspace is derived from the form.',
    }),
    q: searchQueryField.openapi({ description: 'Matches the start of the version number.' }),
  })
  .openapi('Forms_FormVersionLookupQuery');

export const FormVersionLookupResponseSchema = SobaFormVersionLookupResponseSchema.extend({
  items: z.array(FormVersionSummarySchema),
}).openapi('Forms_FormVersionLookupResponse');

const TAG = 'core.forms';
const FORMS_PATH = '/design/forms';
const FORM_PATH = `${FORMS_PATH}/{id}`;
const FORM_VERSIONS_PATH = '/design/form-versions';
const FORM_VERSION_PATH = `${FORM_VERSIONS_PATH}/{id}`;
const FORM_NOT_FOUND = 'Form not found';
const FORM_VERSION_NOT_FOUND = 'Form version not found';
const AUDIENCE_NOT_FOUND = `${FORM_NOT_FOUND}, or the workspace has no Form submitters group`;
const VALIDATION_ERROR = 'Validation or business rule error';
const VERSION_CONFLICT = "Not the form's current version";
const SCHEMA_WRITE_CONFLICT = `${VERSION_CONFLICT}, not a draft, or its schema is being saved`;

export const registerFormsOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: FORMS_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      query: ListFormsQuerySchema,
    },
    responses: {
      200: {
        description: `List forms with search and offset pagination. ${OFFSET_DRIFT_NOTE}`,
        content: {
          'application/json': {
            schema: ListFormsResponseSchema,
          },
        },
      },
      400: {
        description: 'Missing scope anchor, inconsistent hierarchy ids, or invalid query',
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: FORM_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: FormIdParamsSchema,
    },
    responses: {
      200: {
        description: 'Get form by id',
        content: {
          'application/json': {
            schema: FormWithPermissionsResponseSchema,
          },
        },
      },
      404: {
        description: FORM_NOT_FOUND,
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: FORMS_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      query: WorkspaceScopedQuerySchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: CreateFormBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created form with its initial v1 draft',
        content: {
          'application/json': {
            schema: FormWithVersionResponseSchema,
          },
        },
      },
      400: {
        description: VALIDATION_ERROR,
      },
      403: {
        description:
          'Caller lacks form_create and design_create in the workspace (form_admin via *)',
      },
      409: {
        description: FORM_NAME_TAKEN,
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${FORMS_PATH}/normalize`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: NormalizeSchemaBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Schema normalized to a clean, builder-ready form definition',
        content: {
          'application/json': {
            schema: NormalizeSchemaResponseSchema,
          },
        },
      },
      400: {
        description: 'Invalid schema body',
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: FORM_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: FormIdParamsSchema,
      body: {
        required: false,
        content: {
          'application/json': {
            schema: UpdateFormBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated form',
        content: {
          'application/json': {
            schema: FormResponseSchema,
          },
        },
      },
      404: {
        description: FORM_NOT_FOUND,
      },
      409: {
        description: FORM_NAME_TAKEN,
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${FORM_PATH}/submitter-audience`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { query: SortLocaleQuerySchema, params: FormIdParamsSchema },
    responses: {
      200: {
        description: "The form's submit audience: inherited from the workspace or overridden",
        content: { 'application/json': { schema: FormSubmitterAudienceSchema } },
      },
      403: { description: 'Requires form_read' },
      404: { description: AUDIENCE_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'put',
    path: `${FORM_PATH}/submitter-audience`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      query: SortLocaleQuerySchema,
      params: FormIdParamsSchema,
      body: { content: { 'application/json': { schema: SetFormSubmitterAudienceBodySchema } } },
    },
    responses: {
      200: {
        description: 'Updated form submit audience',
        content: { 'application/json': { schema: FormSubmitterAudienceSchema } },
      },
      400: { description: 'Protected needs a provider, or an invalid provider was given' },
      403: { description: 'Requires form_update' },
      404: { description: AUDIENCE_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'get',
    path: FORM_VERSIONS_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      query: ListFormVersionsQuerySchema,
    },
    responses: {
      200: {
        description: `List form versions with offset pagination. ${OFFSET_DRIFT_NOTE}`,
        content: {
          'application/json': {
            schema: ListFormVersionsResponseSchema,
          },
        },
      },
      400: {
        description: 'Missing scope anchor, inconsistent hierarchy ids, or invalid query',
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${FORM_VERSIONS_PATH}/lookup`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      query: FormVersionLookupQuerySchema,
    },
    responses: {
      200: {
        description: `One form's versions for a select, newest first. ${LOOKUP_NOTE}`,
        content: {
          'application/json': {
            schema: FormVersionLookupResponseSchema,
          },
        },
      },
      400: {
        description: 'Missing formId or invalid query',
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: FORM_VERSION_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: FormVersionIdParamsSchema,
    },
    responses: {
      200: {
        description: 'Get form version by id',
        content: {
          'application/json': {
            schema: FormVersionResponseSchema,
          },
        },
      },
      404: {
        description: FORM_VERSION_NOT_FOUND,
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: FORM_VERSIONS_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: CreateFormVersionBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created form version draft',
        content: { 'application/json': { schema: FormVersionResponseSchema } },
      },
      400: {
        description: VALIDATION_ERROR,
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${FORM_VERSION_PATH}/save`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: SaveFormVersionParamsSchema,
      body: {
        required: false,
        content: {
          'application/json': {
            schema: SaveFormVersionBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Saved form version draft',
        content: { 'application/json': { schema: FormVersionResponseSchema } },
      },
      400: {
        description: VALIDATION_ERROR,
      },
      409: { description: SCHEMA_WRITE_CONFLICT },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: FORM_VERSION_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: FormVersionIdParamsSchema,
    },
    responses: {
      204: {
        description: 'Form version marked as deleted',
      },
      404: {
        description: FORM_VERSION_NOT_FOUND,
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: FORM_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: FormIdParamsSchema,
    },
    responses: {
      204: {
        description: 'Form marked as deleted',
      },
      404: {
        description: FORM_NOT_FOUND,
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${FORM_VERSION_PATH}/publish`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { params: FormVersionIdParamsSchema },
    responses: {
      200: {
        description: 'Form version publish action',
        content: { 'application/json': { schema: FormVersionResponseSchema } },
      },
      400: { description: 'Invalid state transition, or not ready to publish' },
      404: { description: FORM_VERSION_NOT_FOUND },
      409: { description: VERSION_CONFLICT },
    },
  });

  for (const action of ['unpublish', 'restore'] as const) {
    registry.registerPath({
      method: 'post',
      path: `${FORM_VERSION_PATH}/${action}`,
      tags: [TAG],
      security: [{ bearerAuth: [] }],
      request: { params: FormVersionIdParamsSchema },
      responses: {
        200: {
          description: `Form version ${action} action`,
          content: { 'application/json': { schema: FormVersionResponseSchema } },
        },
        400: { description: 'Invalid state transition' },
        404: { description: FORM_VERSION_NOT_FOUND },
      },
    });
  }

  registry.registerPath({
    method: 'get',
    path: `${FORM_VERSION_PATH}/schema`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { params: FormVersionIdParamsSchema },
    responses: {
      200: {
        description: 'Form version schema (engine document; engine-managed fields stripped)',
        content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } },
      },
      404: { description: 'Form version or schema not found' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${FORM_VERSION_PATH}/schema`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: FormVersionIdParamsSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: ProvisionSchemaBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Provisioned form version (schema saved to the engine)',
        content: { 'application/json': { schema: FormVersionResponseSchema } },
      },
      400: { description: 'Engine rejected the schema' },
      404: { description: FORM_VERSION_NOT_FOUND },
      409: { description: SCHEMA_WRITE_CONFLICT },
    },
  });
};
