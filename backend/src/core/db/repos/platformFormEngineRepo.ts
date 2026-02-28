import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { platformFormEngines } from '../schema';
import { assertFormEngineInvariantsInMemory } from '../../integrations/form-engine/formEngineInvariants';

export interface PlatformFormEngineRecord {
  id: string;
  code: string;
  name: string;
  engineVersion: string | null;
  isActive: boolean;
  isDefault: boolean;
}

export const listPlatformFormEngines = async (): Promise<PlatformFormEngineRecord[]> =>
  db
    .select()
    .from(platformFormEngines)
    .orderBy(platformFormEngines.code)
    .then((rows) => rows as PlatformFormEngineRecord[]);

export const getActiveFormEngineByCode = async (
  code: string,
): Promise<PlatformFormEngineRecord | null> => {
  const row = await db
    .select()
    .from(platformFormEngines)
    .where(and(eq(platformFormEngines.code, code), eq(platformFormEngines.isActive, true)))
    .limit(1);
  return (row[0] as PlatformFormEngineRecord) ?? null;
};

export const getDefaultActiveFormEngine = async (): Promise<PlatformFormEngineRecord | null> => {
  const row = await db
    .select()
    .from(platformFormEngines)
    .where(
      and(eq(platformFormEngines.isDefault, true), eq(platformFormEngines.isActive, true)),
    )
    .limit(1);
  return (row[0] as PlatformFormEngineRecord) ?? null;
};

export const upsertPlatformFormEngineByCode = async (input: {
  code: string;
  name: string;
  engineVersion?: string;
  isActive: boolean;
  isDefault: boolean;
  actorId?: string;
}): Promise<PlatformFormEngineRecord> => {
  const existing = await db
    .select()
    .from(platformFormEngines)
    .where(eq(platformFormEngines.code, input.code))
    .limit(1);

  if (!existing[0]) {
    const inserted = await db
      .insert(platformFormEngines)
      .values({
        code: input.code,
        name: input.name,
        engineVersion: input.engineVersion,
        isActive: input.isActive,
        isDefault: input.isDefault,
        createdBy: input.actorId ?? null,
        updatedBy: input.actorId ?? null,
      })
      .returning();
    return inserted[0] as PlatformFormEngineRecord;
  }

  const updated = await db
    .update(platformFormEngines)
    .set({
      name: input.name,
      engineVersion: input.engineVersion,
      isActive: input.isActive,
      isDefault: input.isDefault,
      updatedAt: new Date(),
      updatedBy: input.actorId ?? null,
    })
    .where(eq(platformFormEngines.code, input.code))
    .returning();
  return updated[0] as PlatformFormEngineRecord;
};

export const setDefaultFormEngineByCode = async (code: string, actorId?: string): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx
      .update(platformFormEngines)
      .set({
        isDefault: false,
        updatedAt: new Date(),
        updatedBy: actorId ?? null,
      })
      .where(eq(platformFormEngines.isDefault, true));

    const updated = await tx
      .update(platformFormEngines)
      .set({
        isDefault: true,
        updatedAt: new Date(),
        updatedBy: actorId ?? null,
      })
      .where(eq(platformFormEngines.code, code))
      .returning({ id: platformFormEngines.id });
    if (updated.length === 0) {
      throw new Error(`Cannot set default form engine: '${code}' is not registered`);
    }
  });
};

export const assertFormEngineInvariants = async (): Promise<void> => {
  const engines = await listPlatformFormEngines();
  assertFormEngineInvariantsInMemory(engines);
};
