import { z } from 'zod';
export declare const WorkspaceItemSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodString;
    role: z.ZodString;
    status: z.ZodString;
    org: z.ZodNullable<z.ZodString>;
    useCase: z.ZodNullable<z.ZodString>;
    disclaimerAccepted: z.ZodBoolean;
}, z.core.$strip>;
export declare const CreateWorkspaceBodySchema: z.ZodObject<{
    name: z.ZodString;
    org: z.ZodString;
    useCase: z.ZodString;
    disclaimerAccepted: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const UpdateWorkspaceBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    org: z.ZodOptional<z.ZodString>;
    useCase: z.ZodOptional<z.ZodString>;
    disclaimerAccepted: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type WorkspaceItem = z.infer<typeof WorkspaceItemSchema>;
export type CreateWorkspaceBody = z.infer<typeof CreateWorkspaceBodySchema>;
export type UpdateWorkspaceBody = z.infer<typeof UpdateWorkspaceBodySchema>;
export declare const WORKSPACE_SORT_FIELDS: readonly ["name", "kind", "status", "updatedAt"];
export declare const WorkspaceSortSchema: z.ZodEnum<{
    "name:asc": "name:asc";
    "status:asc": "status:asc";
    "updatedAt:asc": "updatedAt:asc";
    "name:desc": "name:desc";
    "status:desc": "status:desc";
    "updatedAt:desc": "updatedAt:desc";
    "kind:asc": "kind:asc";
    "kind:desc": "kind:desc";
}>;
export declare const ListWorkspacesResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodString;
        role: z.ZodString;
        status: z.ZodString;
        org: z.ZodNullable<z.ZodString>;
        useCase: z.ZodNullable<z.ZodString>;
        disclaimerAccepted: z.ZodBoolean;
    }, z.core.$strip>>;
    page: z.ZodObject<{
        offset: z.ZodNumber;
        limit: z.ZodNumber;
        total: z.ZodNumber;
    }, z.core.$strip>;
    filters: z.ZodObject<{
        kind: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
        q: z.ZodOptional<z.ZodString>;
        requiredPermission: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    sort: z.ZodEnum<{
        "name:asc": "name:asc";
        "status:asc": "status:asc";
        "updatedAt:asc": "updatedAt:asc";
        "name:desc": "name:desc";
        "status:desc": "status:desc";
        "updatedAt:desc": "updatedAt:desc";
        "kind:asc": "kind:asc";
        "kind:desc": "kind:desc";
    }>;
}, z.core.$strip>;
export type ListWorkspacesResponse = z.infer<typeof ListWorkspacesResponseSchema>;
