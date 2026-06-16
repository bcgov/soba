import { and, desc, eq, ilike, isNull, lt, or } from 'drizzle-orm';
import { db, type DbOrTx } from '../client';
import { forms, formVersions } from '../schema';

export type FormListSort = 'id:desc' | 'updatedAt:desc';
export type FormCursorMode = 'id' | 'ts_id';

export interface ListFormsForWorkspaceInput {
  workspaceId: string;
  limit: number;
  q?: string;
  status?: string;
  sort: FormListSort;
  cursorMode: FormCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
}

export interface FormListRow {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface FormRecord {
  id: string;
  workspaceId: string;
  formEngineCode: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
}

interface CreateFormInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formEngineCode: string;
  name: string;
  description?: string;
}

interface UpdateFormInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
  name?: string;
  description?: string | null;
  status?: string;
}

export const listFormsForWorkspace = async (
  input: ListFormsForWorkspaceInput,
): Promise<{ items: FormListRow[]; hasMore: boolean }> => {
  const whereClauses = [eq(forms.workspaceId, input.workspaceId), isNull(forms.deletedAt)];

  if (input.status) {
    whereClauses.push(eq(forms.status, input.status));
  }

  if (input.q) {
    const searchPattern = `%${input.q}%`;
    whereClauses.push(ilike(forms.name, searchPattern));
  }

  if (input.cursorMode === 'id' && input.afterId) {
    whereClauses.push(lt(forms.id, input.afterId));
  }

  if (input.cursorMode === 'ts_id' && input.afterId && input.afterUpdatedAt) {
    whereClauses.push(
      or(
        lt(forms.updatedAt, input.afterUpdatedAt),
        and(eq(forms.updatedAt, input.afterUpdatedAt), lt(forms.id, input.afterId)),
      ),
    );
  }

  const rows = await db
    .select({
      id: forms.id,
      name: forms.name,
      status: forms.status,
      createdAt: forms.createdAt,
      updatedAt: forms.updatedAt,
      createdBy: forms.createdBy,
      updatedBy: forms.updatedBy,
    })
    .from(forms)
    .where(and(...whereClauses))
    .orderBy(
      input.cursorMode === 'ts_id' || input.sort === 'updatedAt:desc'
        ? desc(forms.updatedAt)
        : desc(forms.id),
      desc(forms.id),
    )
    .limit(input.limit + 1);

  return {
    items: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
};

export const getFormById = async (
  workspaceId: string,
  formId: string,
): Promise<FormRecord | null> => {
  const row = await db
    .select()
    .from(forms)
    .where(and(eq(forms.workspaceId, workspaceId), eq(forms.id, formId), isNull(forms.deletedAt)))
    .limit(1);

  return row[0] ?? null;
};

export const getFormByEngineSchemaRef = async (
  workspaceId: string,
  engineSchemaRef: string,
): Promise<FormRecord | null> => {
  const rows = await db
    .select({
      id: forms.id,
      workspaceId: forms.workspaceId,
      formEngineCode: forms.formEngineCode,
      name: forms.name,
      description: forms.description,
      status: forms.status,
      createdAt: forms.createdAt,
      updatedAt: forms.updatedAt,
      createdBy: forms.createdBy,
      updatedBy: forms.updatedBy,
      deletedAt: forms.deletedAt,
      deletedBy: forms.deletedBy,
    })
    .from(forms)
    .innerJoin(formVersions, eq(formVersions.formId, forms.id))
    .where(
      and(
        eq(forms.workspaceId, workspaceId),
        eq(formVersions.engineSchemaRef, engineSchemaRef),
        isNull(forms.deletedAt),
        isNull(formVersions.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};

export const createForm = async (input: CreateFormInput, tx?: DbOrTx): Promise<FormRecord> => {
  const d = tx ?? db;
  const created = await d
    .insert(forms)
    .values({
      workspaceId: input.workspaceId,
      formEngineCode: input.formEngineCode,
      name: input.name,
      description: input.description,
      status: 'active',
      createdBy: input.actorDisplayLabel,
      updatedBy: input.actorDisplayLabel,
    })
    .returning();

  return created[0] as FormRecord;
};

export const updateForm = async (input: UpdateFormInput): Promise<FormRecord | null> => {
  const updated = await db
    .update(forms)
    .set({
      name: input.name,
      description: input.description,
      status: input.status,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(forms.id, input.formId),
        eq(forms.workspaceId, input.workspaceId),
        isNull(forms.deletedAt),
      ),
    )
    .returning();

  return (updated[0] as FormRecord) ?? null;
};

export const markFormDeleted = async (
  workspaceId: string,
  formId: string,
  actorDisplayLabel: string | null,
) => {
  const updated = await db
    .update(forms)
    .set({
      status: 'deleted',
      deletedAt: new Date(),
      deletedBy: actorDisplayLabel,
      updatedBy: actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .returning();

  return updated[0] ?? null;
};

export const getFormEngineCodeForForm = async (
  workspaceId: string,
  formId: string,
): Promise<string | null> => {
  const row = await db
    .select({ engineCode: forms.formEngineCode })
    .from(forms)
    .where(and(eq(forms.workspaceId, workspaceId), eq(forms.id, formId), isNull(forms.deletedAt)))
    .limit(1);

  return row[0]?.engineCode ?? null;
};
