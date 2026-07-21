import type { WorkspaceItem } from '@/src/types/workspaces';
import { RxJsonSchema } from 'rxdb';

export const workspaceSchema: RxJsonSchema<WorkspaceItem> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid', // Enforces UUID format
      maxLength: 36, // RxDB requires maxLength on primary keys
    },
    name: { type: 'string', maxLength: 255 },
    kind: { type: 'string' },
    role: { type: 'string' },
    status: { type: 'string' },
    disclaimerAccepted: { type: 'boolean' },
    updatedAt: { type: 'string', format: 'date-time', maxLength: 30 },
  },
  required: ['id', 'name', 'kind', 'role', 'status', 'disclaimerAccepted', 'updatedAt'],
  indexes: ['name', 'updatedAt'],
};
