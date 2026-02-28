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
