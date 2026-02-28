import { and, desc, eq, ilike, isNull, lt, or } from 'drizzle-orm';
import { db } from '../client';
import { forms, platformFormEngines } from '../schema';

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
  slug: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormRecord {
  id: string;
  workspaceId: string;
  formEngineId: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  deletedAt: Date | null;
  deletedBy: string | null;
}

interface CreateFormInput {
  workspaceId: string;
  actorId: string;
  formEngineId: string;
  slug: string;
  name: string;
  description?: string;
}

interface UpdateFormInput {
  workspaceId: string;
  actorId: string;
  formId: string;
  slug?: string;
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
    whereClauses.push(or(ilike(forms.name, searchPattern), ilike(forms.slug, searchPattern)));
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
      slug: forms.slug,
      name: forms.name,
      status: forms.status,
      createdAt: forms.createdAt,
      updatedAt: forms.updatedAt,
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

export const createForm = async (input: CreateFormInput): Promise<FormRecord> => {
  const created = await db
    .insert(forms)
    .values({
      workspaceId: input.workspaceId,
      formEngineId: input.formEngineId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      status: 'active',
      createdBy: input.actorId,
      updatedBy: input.actorId,
    })
    .returning();

  return created[0] as FormRecord;
};

export const updateForm = async (input: UpdateFormInput): Promise<FormRecord | null> => {
  const updated = await db
    .update(forms)
    .set({
      slug: input.slug,
      name: input.name,
      description: input.description,
      status: input.status,
      updatedBy: input.actorId,
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

export const markFormDeleted = async (workspaceId: string, formId: string, actorId: string) => {
  const updated = await db
    .update(forms)
    .set({
      status: 'deleted',
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
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
    .select({ engineCode: platformFormEngines.code })
    .from(forms)
    .innerJoin(platformFormEngines, eq(platformFormEngines.id, forms.formEngineId))
    .where(and(eq(forms.workspaceId, workspaceId), eq(forms.id, formId), isNull(forms.deletedAt)))
    .limit(1);

  return row[0]?.engineCode ?? null;
};
