import { z } from 'zod';

export const ApiErrorSchema = z.object({
  error: z.string(),
});

export const IdParamSchema = z.object({
  id: z.string().min(1),
});
