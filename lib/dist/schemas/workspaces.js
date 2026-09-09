"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListWorkspacesResponseSchema = exports.WorkspaceSortSchema = exports.WORKSPACE_SORT_FIELDS = exports.UpdateWorkspaceBodySchema = exports.CreateWorkspaceBodySchema = exports.WorkspaceItemSchema = void 0;
const zod_1 = require("zod");
const pagination_1 = require("./pagination");
exports.WorkspaceItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    kind: zod_1.z.string(),
    role: zod_1.z.string(),
    status: zod_1.z.string(),
    org: zod_1.z.string().nullable(),
    useCase: zod_1.z.string().nullable(),
    disclaimerAccepted: zod_1.z.boolean(),
});
exports.CreateWorkspaceBodySchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1),
    org: zod_1.z.string().trim().min(1),
    useCase: zod_1.z.string().trim().min(1),
    disclaimerAccepted: zod_1.z.boolean().optional(),
});
exports.UpdateWorkspaceBodySchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).optional(),
    org: zod_1.z.string().trim().min(1).optional(),
    useCase: zod_1.z.string().trim().min(1).optional(),
    disclaimerAccepted: zod_1.z.boolean().optional(),
})
    .refine((body) => body.name !== undefined ||
    body.org !== undefined ||
    body.useCase !== undefined ||
    body.disclaimerAccepted !== undefined, {
    message: 'Provide a field to update',
});
exports.WORKSPACE_SORT_FIELDS = ['name', 'kind', 'status', 'updatedAt'];
exports.WorkspaceSortSchema = (0, pagination_1.makeSortEnum)(exports.WORKSPACE_SORT_FIELDS);
exports.ListWorkspacesResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.WorkspaceItemSchema),
    page: pagination_1.OffsetPageSchema,
    filters: zod_1.z.object({
        kind: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        q: zod_1.z.string().optional(),
        requiredPermission: zod_1.z.string().optional(),
    }),
    sort: exports.WorkspaceSortSchema,
});
