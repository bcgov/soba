import { z } from 'zod';

export const OffsetPageSchema = z.object({
  offset: z.number().int().min(0),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type OffsetPage = z.infer<typeof OffsetPageSchema>;

export type SortToken<TField extends string> = `${TField}:asc` | `${TField}:desc`;

export const sortTokensFor = <TField extends string>(
  fields: readonly TField[],
): SortToken<TField>[] =>
  fields.flatMap((field) => [`${field}:asc`, `${field}:desc`] as SortToken<TField>[]);

export const makeSortEnum = <TField extends string>(fields: readonly TField[]) =>
  z.enum(sortTokensFor(fields) as [SortToken<TField>, ...SortToken<TField>[]]);
