import { z } from 'zod';
export declare const OpenSubmissionBodySchema: z.ZodObject<{
    id: z.ZodString;
    formId: z.ZodString;
}, z.core.$strip>;
export declare const SubmissionDataBodySchema: z.ZodObject<{
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export declare const SubmissionListItemSchema: z.ZodObject<{
    id: z.ZodString;
    formId: z.ZodString;
    formName: z.ZodOptional<z.ZodString>;
    formVersionId: z.ZodString;
    versionNo: z.ZodOptional<z.ZodNumber>;
    workflowState: z.ZodString;
    engineSyncStatus: z.ZodString;
    submittedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    createdBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submittedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const SubmissionResponseSchema: z.ZodObject<{
    id: z.ZodString;
    formId: z.ZodString;
    formVersionId: z.ZodString;
    workflowState: z.ZodString;
    engineSyncStatus: z.ZodString;
    currentRevisionNo: z.ZodNumber;
    submittedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    createdBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submittedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type OpenSubmissionBody = z.infer<typeof OpenSubmissionBodySchema>;
export type SubmissionDataBody = z.infer<typeof SubmissionDataBodySchema>;
export type SubmissionListItem = z.infer<typeof SubmissionListItemSchema>;
export type SubmissionResponse = z.infer<typeof SubmissionResponseSchema>;
export declare const SUBMISSION_SORT_FIELDS: readonly ["formName", "submittedAt", "createdAt", "updatedAt"];
export declare const SubmissionSortSchema: z.ZodEnum<{
    "createdAt:asc": "createdAt:asc";
    "updatedAt:asc": "updatedAt:asc";
    "createdAt:desc": "createdAt:desc";
    "updatedAt:desc": "updatedAt:desc";
    "formName:asc": "formName:asc";
    "submittedAt:asc": "submittedAt:asc";
    "formName:desc": "formName:desc";
    "submittedAt:desc": "submittedAt:desc";
}>;
export declare const ListSubmissionsResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        formId: z.ZodString;
        formName: z.ZodOptional<z.ZodString>;
        formVersionId: z.ZodString;
        versionNo: z.ZodOptional<z.ZodNumber>;
        workflowState: z.ZodString;
        engineSyncStatus: z.ZodString;
        submittedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        createdBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        submittedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    page: z.ZodObject<{
        offset: z.ZodNumber;
        limit: z.ZodNumber;
        total: z.ZodNumber;
    }, z.core.$strip>;
    filters: z.ZodObject<{
        workspaceId: z.ZodOptional<z.ZodString>;
        formId: z.ZodOptional<z.ZodString>;
        formVersionId: z.ZodOptional<z.ZodString>;
        submissionId: z.ZodOptional<z.ZodString>;
        workflowState: z.ZodOptional<z.ZodString>;
        createdBy: z.ZodOptional<z.ZodString>;
        q: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    sort: z.ZodEnum<{
        "createdAt:asc": "createdAt:asc";
        "updatedAt:asc": "updatedAt:asc";
        "createdAt:desc": "createdAt:desc";
        "updatedAt:desc": "updatedAt:desc";
        "formName:asc": "formName:asc";
        "submittedAt:asc": "submittedAt:asc";
        "formName:desc": "formName:desc";
        "submittedAt:desc": "submittedAt:desc";
    }>;
}, z.core.$strip>;
export type ListSubmissionsResponse = z.infer<typeof ListSubmissionsResponseSchema>;
