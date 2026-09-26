import { z } from 'zod';
import { LookupMetaSchema, OffsetPageSchema, makeSortEnum } from './pagination';
import { FORM_SORT_FIELDS, FORM_VERSION_SORT_FIELDS } from '../sort';

import { SetFormSubmitterAudienceBodySchema } from './groups';

export const CreateFormBodySchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  formEngineCode: z.string().trim().min(1).optional(),
  submitterAudience: SetFormSubmitterAudienceBodySchema.optional(),
});

export const UpdateFormBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().trim().min(1).optional(),
  org: z.string().trim().min(1).optional(),
  useCase: z.string().trim().min(1).optional(),
});

export const FormListItemSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  name: z.string(),
  org: z.string(),
  useCase: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});

export const FormResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  org: z.string(),
  useCase: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const FormVersionResponseSchema = z.object({
  id: z.string(),
  formId: z.string(),
  versionNo: z.number().int(),
  state: z.string(),
  engineSyncStatus: z.string(),
  engineSchemaRef: z.string().nullable(),
  currentRevisionNo: z.number().int(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const FormWithVersionResponseSchema = FormResponseSchema.extend({
  formVersion: FormVersionResponseSchema.nullable(),
});

export const FormVersionSummarySchema = z.object({
  id: z.string(),
  versionNo: z.number().int(),
  state: z.string(),
});

export const FormWithPermissionsResponseSchema = FormResponseSchema.extend({
  permissions: z.array(z.string()),
  /** The highest-numbered version that is not deleted. Save and publish target this one. */
  currentVersion: FormVersionSummarySchema.nullable(),
});

export const FormVersionListItemSchema = z.object({
  id: z.string(),
  formId: z.string(),
  versionNo: z.number().int(),
  state: z.string(),
  engineSyncStatus: z.string(),
  engineSchemaRef: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});

export type CreateFormBody = z.infer<typeof CreateFormBodySchema>;
export type UpdateFormBody = z.infer<typeof UpdateFormBodySchema>;
export type FormListItem = z.infer<typeof FormListItemSchema>;
export type FormResponse = z.infer<typeof FormResponseSchema>;
export type FormVersionResponse = z.infer<typeof FormVersionResponseSchema>;
export type FormWithVersionResponse = z.infer<typeof FormWithVersionResponseSchema>;
export type FormVersionSummary = z.infer<typeof FormVersionSummarySchema>;
export type FormWithPermissionsResponse = z.infer<typeof FormWithPermissionsResponseSchema>;
export type FormVersionListItem = z.infer<typeof FormVersionListItemSchema>;

export const FormSortSchema = makeSortEnum(FORM_SORT_FIELDS);

export const ListFormsResponseSchema = z.object({
  items: z.array(FormListItemSchema),
  page: OffsetPageSchema,
  filters: z.object({
    workspaceId: z.string().optional(),
    formId: z.string().optional(),
    q: z.string().optional(),
    status: z.string().optional(),
  }),
  sort: FormSortSchema,
});

export type ListFormsResponse = z.infer<typeof ListFormsResponseSchema>;

export const FormVersionSortSchema = makeSortEnum(FORM_VERSION_SORT_FIELDS);

export const ListFormVersionsResponseSchema = z.object({
  items: z.array(FormVersionListItemSchema),
  page: OffsetPageSchema,
  filters: z.object({
    workspaceId: z.string().optional(),
    formId: z.string().optional(),
    formVersionId: z.string().optional(),
    state: z.string().optional(),
  }),
  sort: FormVersionSortSchema,
});

export type ListFormVersionsResponse = z.infer<typeof ListFormVersionsResponseSchema>;

export const FormVersionLookupResponseSchema = LookupMetaSchema.extend({
  items: z.array(FormVersionSummarySchema),
});

export type FormVersionLookupResponse = z.infer<typeof FormVersionLookupResponseSchema>;
