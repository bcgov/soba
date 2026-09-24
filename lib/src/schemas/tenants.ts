import { z } from 'zod';

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  ministryName: z.string(),
  description: z.string().optional(),
  createdDateTime: z.string(),
  updatedDateTime: z.string(),
  createdBy: z.string(),
  createdByUserName: z.string().optional(),
  createdByDisplayName: z.string().optional(),
  updatedBy: z.string().optional(),
});

export const ListTenantsResponseSchema = z.object({
  tenants: z.array(TenantSchema),
});
