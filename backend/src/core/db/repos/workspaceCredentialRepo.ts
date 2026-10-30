import type { CredentialType, CREDENTIAL_SORT_FIELDS, SortLocale, SortToken } from '@soba/lib';
import { and, count, eq, ilike, or, getTableColumns, isNull, sql } from 'drizzle-orm';
import { db } from '../client';
import { readListPage } from '../listRead';
import { likePattern, orderByForSort, type SortColumns } from '../listSort';
import {
  credentialAudit,
  credentialTypeAssignments,
  workspaceCredentials,
} from '../schema/workspaceCredential';
import type { IssuedApiKey } from '../../integrations/credential-issuer/CredentialIssuerAdapter';

export type CredentialListInput = {
  offset: number;
  limit: number;
  sort: SortToken<(typeof CREDENTIAL_SORT_FIELDS)[number]>;
  q?: string;
  locale: SortLocale;
};

export type CredentialRecord = typeof workspaceCredentials.$inferSelect & {
  types: CredentialType[];
};
/** Metadata accepted when reserving a new credential row. */
export type ReserveCredentialInput = Pick<
  typeof workspaceCredentials.$inferInsert,
  'label' | 'notes'
> & { types: CredentialType[] };

const credentialSelection = {
  ...getTableColumns(workspaceCredentials),
  types: sql<CredentialType[]>`array(
    select ${credentialTypeAssignments.typeCode} from ${credentialTypeAssignments}
    where ${credentialTypeAssignments.credentialId} = ${workspaceCredentials.id}
    order by ${credentialTypeAssignments.typeCode}
  )`,
};
const inScope = (workspaceId: string, formId: string | null) =>
  and(
    eq(workspaceCredentials.workspaceId, workspaceId),
    formId === null ? isNull(workspaceCredentials.formId) : eq(workspaceCredentials.formId, formId),
  );

export const getWorkspaceCredential = async (
  workspaceId: string,
  id: string,
  formId: string | null = null,
): Promise<CredentialRecord | null> => {
  const [row] = await db
    .select(credentialSelection)
    .from(workspaceCredentials)
    .where(and(inScope(workspaceId, formId), eq(workspaceCredentials.id, id)));
  return row ?? null;
};

const CREDENTIAL_SORT_COLUMNS: SortColumns<(typeof CREDENTIAL_SORT_FIELDS)[number]> = {
  label: { column: workspaceCredentials.label, linguistic: true },
  status: { column: workspaceCredentials.status },
  createdAt: { column: workspaceCredentials.createdAt },
};

export const listWorkspaceCredentials = (
  workspaceId: string,
  query: CredentialListInput,
  formId: string | null = null,
): Promise<{ items: CredentialRecord[]; total: number }> =>
  readListPage(async (tx) => {
    const where = and(
      inScope(workspaceId, formId),
      query.q
        ? or(
            ilike(workspaceCredentials.label, likePattern(query.q)),
            ilike(workspaceCredentials.notes, likePattern(query.q)),
          )
        : undefined,
    );
    const items = await tx
      .select(credentialSelection)
      .from(workspaceCredentials)
      .where(where)
      .orderBy(
        ...orderByForSort(
          CREDENTIAL_SORT_COLUMNS,
          query.sort,
          workspaceCredentials.id,
          query.locale,
        ),
      )
      .limit(query.limit)
      .offset(query.offset);
    const [totals] = await tx.select({ total: count() }).from(workspaceCredentials).where(where);
    return { items, total: totals?.total ?? 0 };
  });

export const reserveWorkspaceCredential = async (
  workspaceId: string,
  issuerCode: string,
  actorId: string,
  input: ReserveCredentialInput,
  formId: string | null = null,
): Promise<CredentialRecord | null> =>
  db.transaction(async (tx) => {
    if (!input.types.length) throw new Error('A credential requires at least one type');
    const [row] = await tx
      .insert(workspaceCredentials)
      .values({
        workspaceId,
        formId,
        issuerCode,
        label: input.label,
        notes: input.notes,
        status: 'issuing',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) return null;
    await tx
      .insert(credentialTypeAssignments)
      .values(input.types.map((typeCode) => ({ credentialId: row.id, typeCode })));
    await tx
      .insert(credentialAudit)
      .values({ credentialId: row.id, actorId, action: 'issue_started' });
    return { ...row, types: [...input.types].sort((a, b) => a.localeCompare(b)) };
  });

export const reserveCredentialRotation = async (
  workspaceId: string,
  id: string,
  actorId: string,
  formId: string | null = null,
): Promise<CredentialRecord | null> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(workspaceCredentials)
      .set({ status: 'rotating', updatedBy: actorId, updatedAt: new Date() })
      .where(
        and(
          inScope(workspaceId, formId),
          eq(workspaceCredentials.id, id),
          eq(workspaceCredentials.status, 'active'),
        ),
      )
      .returning(credentialSelection);
    if (!row) return null;
    await tx
      .insert(credentialAudit)
      .values({ credentialId: row.id, actorId, action: 'regenerate_started' });
    return row;
  });

// Explicitly select metadata; never spread an upstream result into persistence or audit events.
export const completeCredentialOperation = async (
  record: CredentialRecord,
  actorId: string,
  credential: IssuedApiKey,
): Promise<CredentialRecord> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(workspaceCredentials)
      .set({
        clientId: credential.clientId,
        flow: credential.flow,
        status: 'active',
        updatedBy: actorId,
        updatedAt: new Date(),
        ...(record.status === 'rotating' ? { rotatedAt: new Date() } : {}),
      })
      .where(
        and(
          eq(workspaceCredentials.id, record.id),
          eq(workspaceCredentials.workspaceId, record.workspaceId),
          eq(workspaceCredentials.status, record.status),
        ),
      )
      .returning(credentialSelection);
    if (!row) throw new Error('Credential operation reservation changed');
    await tx.insert(credentialAudit).values({
      credentialId: row.id,
      actorId,
      action: record.status === 'rotating' ? 'regenerate_completed' : 'issue_completed',
    });
    return row;
  });

export const markCredentialUnknown = async (
  record: CredentialRecord,
  actorId: string,
): Promise<void> => {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(workspaceCredentials)
      .set({ status: 'unknown', updatedBy: actorId, updatedAt: new Date() })
      .where(
        and(eq(workspaceCredentials.id, record.id), eq(workspaceCredentials.status, record.status)),
      )
      .returning(credentialSelection);
    if (row)
      await tx
        .insert(credentialAudit)
        .values({ credentialId: row.id, actorId, action: 'outcome_unknown' });
  });
};

export const updateCredentialNotes = async (
  workspaceId: string,
  id: string,
  actorId: string,
  notes: string,
  formId: string | null = null,
): Promise<CredentialRecord | null> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(workspaceCredentials)
      .set({ notes, updatedBy: actorId, updatedAt: new Date() })
      .where(and(inScope(workspaceId, formId), eq(workspaceCredentials.id, id)))
      .returning(credentialSelection);
    if (!row) return null;
    await tx.insert(credentialAudit).values({ credentialId: id, actorId, action: 'notes_updated' });
    return row;
  });
