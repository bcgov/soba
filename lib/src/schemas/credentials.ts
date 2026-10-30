import { z } from 'zod';
import { CREDENTIAL_SORT_FIELDS } from '../sort';
import { makeSortEnum, OffsetPageSchema } from './pagination';

export const CredentialTypeSchema = z.enum(['api', 'web-component']);
export const CreateCredentialSchema = z.strictObject({
  label: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(1000),
  types: z
    .array(CredentialTypeSchema)
    .min(1)
    .max(2)
    .refine((types) => new Set(types).size === types.length, 'Choose each type only once'),
});
export type CreateCredential = z.infer<typeof CreateCredentialSchema>;
export type CredentialType = z.infer<typeof CredentialTypeSchema>;
export const CredentialMetadataSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  notes: z.string(),
  types: z.array(CredentialTypeSchema),
  status: z.enum(['issuing', 'active', 'rotating', 'unknown']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  rotatedAt: z.iso.datetime().nullable(),
});
export const CredentialStateSchema = z.object({
  available: z.boolean(),
  items: z.array(CredentialMetadataSchema),
  page: OffsetPageSchema,
  filters: z.object({ q: z.string().optional() }),
  sort: makeSortEnum(CREDENTIAL_SORT_FIELDS),
});
export const CredentialSecretSchema = z.object({
  credential: CredentialMetadataSchema,
  apiKey: z.string(),
});
export type CredentialMetadata = z.infer<typeof CredentialMetadataSchema>;
export type CredentialState = z.infer<typeof CredentialStateSchema>;
export type CredentialSecret = z.infer<typeof CredentialSecretSchema>;
