import { z } from 'zod';
import { OffsetPageSchema, makeSortEnum } from './pagination';
import { SUBMISSION_SORT_FIELDS } from '../sort';

export const OpenSubmissionBodySchema = z.object({
  // v7 only: the client mints this id, and it is the submission's identity.
  id: z.uuidv7(),
  formId: z.string().min(1),
  // Must be the form's published version when given.
  formVersionId: z.uuid().optional(),
});

export const SubmissionDataBodySchema = z.object({
  data: z.record(z.string(), z.unknown()),
  // Client-minted id for the revision this write creates. A retry reuses it.
  revisionId: z.uuidv7(),
  // The head revision the client loaded. A write whose base is no longer the head is refused.
  baseRevisionId: z.uuid(),
});

// Revision ids are optional on submit; send both or neither.
export const SubmitSubmissionBodySchema = SubmissionDataBodySchema.partial({
  revisionId: true,
  baseRevisionId: true,
}).refine((body) => (body.revisionId === undefined) === (body.baseRevisionId === undefined), {
  message: 'revisionId and baseRevisionId must be sent together',
});

export const SubmissionListItemSchema = z.object({
  id: z.string(),
  formId: z.string(),
  formName: z.string().optional(),
  formVersionId: z.string(),
  versionNo: z.number().int().optional(),
  workflowState: z.string(),
  engineSyncStatus: z.string(),
  submittedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable().optional(),
  submittedBy: z.string().nullable().optional(),
});

export const SubmissionResponseSchema = z.object({
  id: z.string(),
  formId: z.string(),
  formVersionId: z.string(),
  workflowState: z.string(),
  engineSyncStatus: z.string(),
  currentRevisionNo: z.number().int(),
  headRevisionId: z.string().nullable(),
  submittedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable().optional(),
  submittedBy: z.string().nullable().optional(),
});

export type OpenSubmissionBody = z.infer<typeof OpenSubmissionBodySchema>;
export type SubmissionDataBody = z.infer<typeof SubmissionDataBodySchema>;
export type SubmitSubmissionBody = z.infer<typeof SubmitSubmissionBodySchema>;
export type SubmissionListItem = z.infer<typeof SubmissionListItemSchema>;
export type SubmissionResponse = z.infer<typeof SubmissionResponseSchema>;

export const SubmissionSortSchema = makeSortEnum(SUBMISSION_SORT_FIELDS);
export type SubmissionListSort = z.infer<typeof SubmissionSortSchema>;

export const ListSubmissionsResponseSchema = z.object({
  items: z.array(SubmissionListItemSchema),
  page: OffsetPageSchema,
  filters: z.object({
    workspaceId: z.string().optional(),
    formId: z.string().optional(),
    formVersionId: z.string().optional(),
    submissionId: z.string().optional(),
    workflowState: z.string().optional(),
    createdBy: z.string().optional(),
    q: z.string().optional(),
  }),
  sort: SubmissionSortSchema,
});

export type ListSubmissionsResponse = z.infer<typeof ListSubmissionsResponseSchema>;
