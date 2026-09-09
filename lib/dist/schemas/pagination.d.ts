import { z } from 'zod';
export declare const OffsetPageSchema: z.ZodObject<{
    offset: z.ZodNumber;
    limit: z.ZodNumber;
    total: z.ZodNumber;
}, z.core.$strip>;
export type OffsetPage = z.infer<typeof OffsetPageSchema>;
export type SortToken<TField extends string> = `${TField}:asc` | `${TField}:desc`;
export declare const sortTokensFor: <TField extends string>(fields: readonly TField[]) => SortToken<TField>[];
export declare const makeSortEnum: <TField extends string>(fields: readonly TField[]) => z.ZodEnum<{ [k_1 in SortToken<TField>]: k_1; } extends infer T ? { [k in keyof T]: T[k]; } : never>;
