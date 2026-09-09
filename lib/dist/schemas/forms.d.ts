import { z } from 'zod';
export declare const CreateFormBodySchema: z.ZodObject<{
    workspaceId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    formEngineCode: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const UpdateFormBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodString>;
    org: z.ZodOptional<z.ZodString>;
    useCase: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const FormListItemSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    org: z.ZodString;
    useCase: z.ZodString;
    status: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    createdBy: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const FormResponseSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    org: z.ZodString;
    useCase: z.ZodString;
    status: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const FormVersionResponseSchema: z.ZodObject<{
    id: z.ZodString;
    formId: z.ZodString;
    versionNo: z.ZodNumber;
    state: z.ZodString;
    engineSyncStatus: z.ZodString;
    engineSchemaRef: z.ZodNullable<z.ZodString>;
    currentRevisionNo: z.ZodNumber;
    publishedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const FormWithVersionResponseSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    org: z.ZodString;
    useCase: z.ZodString;
    status: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    formVersion: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        formId: z.ZodString;
        versionNo: z.ZodNumber;
        state: z.ZodString;
        engineSyncStatus: z.ZodString;
        engineSchemaRef: z.ZodNullable<z.ZodString>;
        currentRevisionNo: z.ZodNumber;
        publishedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const FormWithPermissionsResponseSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    org: z.ZodString;
    useCase: z.ZodString;
    status: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    permissions: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const FormVersionListItemSchema: z.ZodObject<{
    id: z.ZodString;
    formId: z.ZodString;
    versionNo: z.ZodNumber;
    state: z.ZodString;
    engineSyncStatus: z.ZodString;
    engineSchemaRef: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type CreateFormBody = z.infer<typeof CreateFormBodySchema>;
export type UpdateFormBody = z.infer<typeof UpdateFormBodySchema>;
export type FormListItem = z.infer<typeof FormListItemSchema>;
export type FormResponse = z.infer<typeof FormResponseSchema>;
export type FormVersionResponse = z.infer<typeof FormVersionResponseSchema>;
export type FormWithVersionResponse = z.infer<typeof FormWithVersionResponseSchema>;
export type FormWithPermissionsResponse = z.infer<typeof FormWithPermissionsResponseSchema>;
export type FormVersionListItem = z.infer<typeof FormVersionListItemSchema>;
export declare const FORM_SORT_FIELDS: readonly ["name", "status", "createdAt", "updatedAt"];
export declare const FormSortSchema: z.ZodEnum<{
    "name:asc": "name:asc";
    "status:asc": "status:asc";
    "createdAt:asc": "createdAt:asc";
    "updatedAt:asc": "updatedAt:asc";
    "name:desc": "name:desc";
    "status:desc": "status:desc";
    "createdAt:desc": "createdAt:desc";
    "updatedAt:desc": "updatedAt:desc";
}>;
export declare const ListFormsResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        name: z.ZodString;
        org: z.ZodString;
        useCase: z.ZodString;
        status: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        createdBy: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    page: z.ZodObject<{
        offset: z.ZodNumber;
        limit: z.ZodNumber;
        total: z.ZodNumber;
    }, z.core.$strip>;
    filters: z.ZodObject<{
        workspaceId: z.ZodOptional<z.ZodString>;
        formId: z.ZodOptional<z.ZodString>;
        q: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    sort: z.ZodEnum<{
        "name:asc": "name:asc";
        "status:asc": "status:asc";
        "createdAt:asc": "createdAt:asc";
        "updatedAt:asc": "updatedAt:asc";
        "name:desc": "name:desc";
        "status:desc": "status:desc";
        "createdAt:desc": "createdAt:desc";
        "updatedAt:desc": "updatedAt:desc";
    }>;
}, z.core.$strip>;
export type ListFormsResponse = z.infer<typeof ListFormsResponseSchema>;
