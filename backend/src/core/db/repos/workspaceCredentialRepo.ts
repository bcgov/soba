import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { credentialAudit, workspaceCredentials } from '../schema/workspaceCredential';
import type { IssuedApiKey } from '../../integrations/credential-issuer/CredentialIssuerAdapter';

export type CredentialRecord = typeof workspaceCredentials.$inferSelect;

export const getWorkspaceCredential = async (
  workspaceId: string,
): Promise<CredentialRecord | null> => {
  const [row] = await db
    .select()
    .from(workspaceCredentials)
    .where(eq(workspaceCredentials.workspaceId, workspaceId));
  return row ?? null;
};

export const reserveWorkspaceCredential = async (
  workspaceId: string,
  issuerCode: string,
  actorId: string,
): Promise<CredentialRecord | null> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .insert(workspaceCredentials)
      .values({
        workspaceId,
        issuerCode,
        status: 'issuing',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) return null;
    await tx
      .insert(credentialAudit)
      .values({ credentialId: row.id, actorId, action: 'issue_started' });
    return row;
  });

export const reserveCredentialRotation = async (
  workspaceId: string,
  id: string,
  actorId: string,
): Promise<CredentialRecord | null> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(workspaceCredentials)
      .set({ status: 'rotating', updatedBy: actorId, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceCredentials.workspaceId, workspaceId),
          eq(workspaceCredentials.id, id),
          eq(workspaceCredentials.status, 'active'),
        ),
      )
      .returning();
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
      .returning();
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
      .returning();
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
): Promise<CredentialRecord | null> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(workspaceCredentials)
      .set({ notes, updatedBy: actorId, updatedAt: new Date() })
      .where(
        and(eq(workspaceCredentials.workspaceId, workspaceId), eq(workspaceCredentials.id, id)),
      )
      .returning();
    if (!row) return null;
    await tx.insert(credentialAudit).values({ credentialId: id, actorId, action: 'notes_updated' });
    return row;
  });
