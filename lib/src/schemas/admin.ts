import { z } from 'zod';
import { OffsetPageSchema, makeSortEnum } from './pagination';

export const SOBA_ADMIN_SORT_FIELDS = ['displayLabel', 'source', 'syncedAt'] as const;
export const SobaAdminSortSchema = makeSortEnum(SOBA_ADMIN_SORT_FIELDS);

export const SobaAdminItemSchema = z.object({
  userId: z.string(),
  source: z.string(),
  identityProviderCode: z.string().nullable(),
  syncedAt: z.string().nullable(),
  displayLabel: z.string().nullable(),
});
export type SobaAdminItem = z.infer<typeof SobaAdminItemSchema>;

export const ListSobaAdminsResponseSchema = z.object({
  items: z.array(SobaAdminItemSchema),
  page: OffsetPageSchema,
  filters: z.object({
    source: z.string().optional(),
    q: z.string().optional(),
  }),
  sort: SobaAdminSortSchema,
});
export type ListSobaAdminsResponse = z.infer<typeof ListSobaAdminsResponseSchema>;

export const AddSobaAdminBodySchema = z.object({
  userId: z.string().uuid(),
});
export type AddSobaAdminBody = z.infer<typeof AddSobaAdminBodySchema>;

export const FEATURE_SCOPE_SORT_FIELDS = [
  'featureCode',
  'scopeType',
  'status',
  'createdAt',
  'updatedAt',
] as const;
export const FeatureScopeSortSchema = makeSortEnum(FEATURE_SCOPE_SORT_FIELDS);

export const FeatureScopeItemSchema = z.object({
  id: z.string().uuid(),
  featureCode: z.string(),
  scopeType: z.enum(['workspace', 'form']),
  scopeId: z.string().uuid(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type FeatureScopeItem = z.infer<typeof FeatureScopeItemSchema>;

export const ListFeatureScopesResponseSchema = z.object({
  items: z.array(FeatureScopeItemSchema),
  page: OffsetPageSchema,
  filters: z.object({
    featureCode: z.string().optional(),
    scopeType: z.string().optional(),
    status: z.string().optional(),
  }),
  sort: FeatureScopeSortSchema,
});
export type ListFeatureScopesResponse = z.infer<typeof ListFeatureScopesResponseSchema>;

export const UpsertFeatureScopeBodySchema = z.object({
  featureCode: z.string().min(1),
  scopeType: z.enum(['workspace', 'form']),
  scopeId: z.string().uuid(),
  status: z.enum(['active', 'inactive']).optional(),
});
export type UpsertFeatureScopeBody = z.infer<typeof UpsertFeatureScopeBodySchema>;

export const DOCGEN_AUDIT_SORT_FIELDS = ['createdAt', 'outcome', 'durationMs'] as const;
export const DocgenAuditSortSchema = makeSortEnum(DOCGEN_AUDIT_SORT_FIELDS);

export const DocumentGenerationAuditItemSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  formId: z.string().uuid(),
  submissionId: z.string().uuid(),
  mode: z.string(),
  backendCode: z.string(),
  outcome: z.string(),
  httpStatus: z.number().int().nullable(),
  durationMs: z.number().int(),
  errorDetail: z.string().nullable(),
  requestId: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
});
export type DocumentGenerationAuditItem = z.infer<typeof DocumentGenerationAuditItemSchema>;

export const ListDocumentGenerationAuditsResponseSchema = z.object({
  items: z.array(DocumentGenerationAuditItemSchema),
  page: OffsetPageSchema,
  filters: z.object({
    workspaceId: z.string().optional(),
    formId: z.string().optional(),
  }),
  sort: DocgenAuditSortSchema,
});
export type ListDocumentGenerationAuditsResponse = z.infer<typeof ListDocumentGenerationAuditsResponseSchema>;
