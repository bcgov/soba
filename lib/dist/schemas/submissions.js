"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListSubmissionsResponseSchema = exports.SubmissionSortSchema = exports.SUBMISSION_SORT_FIELDS = exports.SubmissionResponseSchema = exports.SubmissionListItemSchema = exports.SubmissionDataBodySchema = exports.OpenSubmissionBodySchema = void 0;
const zod_1 = require("zod");
const pagination_1 = require("./pagination");
exports.OpenSubmissionBodySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(), // Note: previously uuidv7(), uuid() is compatible. If strict uuidv7 is needed, we'll keep as string or custom refinement.
    formId: zod_1.z.string().min(1),
});
exports.SubmissionDataBodySchema = zod_1.z.object({
    data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
});
exports.SubmissionListItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    formId: zod_1.z.string(),
    formName: zod_1.z.string().optional(),
    formVersionId: zod_1.z.string(),
    versionNo: zod_1.z.number().int().optional(),
    workflowState: zod_1.z.string(),
    engineSyncStatus: zod_1.z.string(),
    submittedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    createdBy: zod_1.z.string().nullable().optional(),
    submittedBy: zod_1.z.string().nullable().optional(),
});
exports.SubmissionResponseSchema = zod_1.z.object({
    id: zod_1.z.string(),
    formId: zod_1.z.string(),
    formVersionId: zod_1.z.string(),
    workflowState: zod_1.z.string(),
    engineSyncStatus: zod_1.z.string(),
    currentRevisionNo: zod_1.z.number().int(),
    submittedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    createdBy: zod_1.z.string().nullable().optional(),
    submittedBy: zod_1.z.string().nullable().optional(),
});
exports.SUBMISSION_SORT_FIELDS = [
    'formName',
    'submittedAt',
    'createdAt',
    'updatedAt',
];
exports.SubmissionSortSchema = (0, pagination_1.makeSortEnum)(exports.SUBMISSION_SORT_FIELDS);
exports.ListSubmissionsResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.SubmissionListItemSchema),
    page: pagination_1.OffsetPageSchema,
    filters: zod_1.z.object({
        workspaceId: zod_1.z.string().optional(),
        formId: zod_1.z.string().optional(),
        formVersionId: zod_1.z.string().optional(),
        submissionId: zod_1.z.string().optional(),
        workflowState: zod_1.z.string().optional(),
        createdBy: zod_1.z.string().optional(),
        q: zod_1.z.string().optional(),
    }),
    sort: exports.SubmissionSortSchema,
});
