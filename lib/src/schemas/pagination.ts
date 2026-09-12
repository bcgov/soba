import { z } from 'zod';
import { sortTokensFor, type SortToken } from '../sort';

export const OffsetPageSchema = z.object({
  offset: z.number().int().min(0),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type OffsetPage = z.infer<typeof OffsetPageSchema>;

export const makeSortEnum = <TField extends string>(fields: readonly TField[]) =>
  z.enum(sortTokensFor(fields) as [SortToken<TField>, ...SortToken<TField>[]]);
