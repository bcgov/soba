"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListFormsResponseSchema = exports.FormSortSchema = exports.FORM_SORT_FIELDS = exports.FormVersionListItemSchema = exports.FormWithPermissionsResponseSchema = exports.FormWithVersionResponseSchema = exports.FormVersionResponseSchema = exports.FormResponseSchema = exports.FormListItemSchema = exports.UpdateFormBodySchema = exports.CreateFormBodySchema = void 0;
const zod_1 = require("zod");
const pagination_1 = require("./pagination");
exports.CreateFormBodySchema = zod_1.z.object({
    workspaceId: zod_1.z.string().min(1),
    name: zod_1.z.string().trim().min(1),
    description: zod_1.z.string().optional(),
    formEngineCode: zod_1.z.string().trim().min(1).optional(),
});
exports.UpdateFormBodySchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).optional(),
    description: zod_1.z.string().nullable().optional(),
    status: zod_1.z.string().trim().min(1).optional(),
    org: zod_1.z.string().trim().min(1).optional(),
    useCase: zod_1.z.string().trim().min(1).optional(),
});
exports.FormListItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    workspaceId: zod_1.z.string(),
    name: zod_1.z.string(),
    org: zod_1.z.string(),
    useCase: zod_1.z.string(),
    status: zod_1.z.string(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    createdBy: zod_1.z.string().nullable(),
});
exports.FormResponseSchema = zod_1.z.object({
    id: zod_1.z.string(),
    workspaceId: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    org: zod_1.z.string(),
    useCase: zod_1.z.string(),
    status: zod_1.z.string(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.FormVersionResponseSchema = zod_1.z.object({
    id: zod_1.z.string(),
    formId: zod_1.z.string(),
    versionNo: zod_1.z.number().int(),
    state: zod_1.z.string(),
    engineSyncStatus: zod_1.z.string(),
    engineSchemaRef: zod_1.z.string().nullable(),
    currentRevisionNo: zod_1.z.number().int(),
    publishedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.FormWithVersionResponseSchema = exports.FormResponseSchema.extend({
    formVersion: exports.FormVersionResponseSchema.nullable(),
});
exports.FormWithPermissionsResponseSchema = exports.FormResponseSchema.extend({
    permissions: zod_1.z.array(zod_1.z.string()),
});
exports.FormVersionListItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    formId: zod_1.z.string(),
    versionNo: zod_1.z.number().int(),
    state: zod_1.z.string(),
    engineSyncStatus: zod_1.z.string(),
    engineSchemaRef: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.FORM_SORT_FIELDS = ['name', 'status', 'createdAt', 'updatedAt'];
exports.FormSortSchema = (0, pagination_1.makeSortEnum)(exports.FORM_SORT_FIELDS);
exports.ListFormsResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.FormListItemSchema),
    page: pagination_1.OffsetPageSchema,
    filters: zod_1.z.object({
        workspaceId: zod_1.z.string().optional(),
        formId: zod_1.z.string().optional(),
        q: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
    }),
    sort: exports.FormSortSchema,
});
