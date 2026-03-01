import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const CursorSortSchema = z.enum(['id:desc', 'updatedAt:desc']).openapi('Core_CursorSort');
export type CursorSort = z.infer<typeof CursorSortSchema>;

export const CursorTokenSchema = z
  .discriminatedUnion('m', [
    z.object({
      m: z.literal('id'),
      id: z.string().min(1),
    }),
    z.object({
      m: z.literal('ts_id'),
      ts: z.string().datetime(),
      id: z.string().min(1),
    }),
  ])
  .openapi('Core_CursorToken');

export type CursorToken = z.infer<typeof CursorTokenSchema>;
export type CursorMode = CursorToken['m'];

export const resolveCursorMode = (input: {
  sort?: CursorSort;
  cursor?: CursorToken;
}): CursorMode => {
  if (input.cursor) return input.cursor.m;
  if (input.sort === 'updatedAt:desc') return 'ts_id';
  return 'id';
};

export const encodeCursor = (cursor: CursorToken): string =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

export const decodeCursor = (rawCursor: string): CursorToken => {
  try {
    const decoded = Buffer.from(rawCursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    return CursorTokenSchema.parse(parsed);
  } catch {
    throw new Error('Invalid cursor');
  }
};

export interface CursorQuery {
  cursor?: string;
  sort?: CursorSort;
}

export interface DecodedCursorMode {
  cursorMode: CursorMode;
  sort: CursorSort;
  afterId?: string;
  afterUpdatedAt?: Date;
}

export function decodeCursorAndMode(query: CursorQuery): DecodedCursorMode {
  const decodedCursor = query.cursor ? decodeCursor(query.cursor) : undefined;
  const cursorMode = resolveCursorMode({ sort: query.sort, cursor: decodedCursor });
  const sort = query.sort ?? 'id:desc';
  return {
    cursorMode,
    sort,
    afterId: decodedCursor?.id,
    afterUpdatedAt: decodedCursor?.m === 'ts_id' ? new Date(decodedCursor.ts) : undefined,
  };
}

export interface CursorListItem {
  id: string;
  updatedAt: Date;
}

export function buildNextCursor(
  lastItem: CursorListItem | undefined,
  hasMore: boolean,
  cursorMode: CursorMode,
): string | null {
  if (!hasMore || !lastItem) return null;
  return encodeCursor(
    cursorMode === 'ts_id'
      ? { m: 'ts_id', ts: lastItem.updatedAt.toISOString(), id: lastItem.id }
      : { m: 'id', id: lastItem.id },
  );
}
