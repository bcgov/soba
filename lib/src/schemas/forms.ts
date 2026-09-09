import { z } from 'zod';
import { OffsetPageSchema, makeSortEnum } from './pagination';

export const CreateFormBodySchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  formEngineCode: z.string().trim().min(1).optional(),
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
  name: z.string(),
  org: z.string(),
  useCase: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
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

export const FormWithPermissionsResponseSchema = FormResponseSchema.extend({
  permissions: z.array(z.string()),
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
});

export type CreateFormBody = z.infer<typeof CreateFormBodySchema>;
export type UpdateFormBody = z.infer<typeof UpdateFormBodySchema>;
export type FormListItem = z.infer<typeof FormListItemSchema>;
export type FormResponse = z.infer<typeof FormResponseSchema>;
export type FormVersionResponse = z.infer<typeof FormVersionResponseSchema>;
export type FormWithVersionResponse = z.infer<typeof FormWithVersionResponseSchema>;
export type FormWithPermissionsResponse = z.infer<typeof FormWithPermissionsResponseSchema>;
export type FormVersionListItem = z.infer<typeof FormVersionListItemSchema>;

export const FORM_SORT_FIELDS = ['name', 'status', 'createdAt', 'updatedAt'] as const;

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
