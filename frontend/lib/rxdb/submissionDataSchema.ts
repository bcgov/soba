import { RxJsonSchema } from 'rxdb';

export interface SubmissionDataDocument {
  id: string;
  data: Record<string, unknown>;
  updatedAt: string;
  isDraft: boolean;
}

export const submissionDataSchema: RxJsonSchema<SubmissionDataDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      maxLength: 36,
    },
    data: {
      type: 'object',
    },
    updatedAt: { type: 'string', format: 'date-time', maxLength: 30 },
    isDraft: { type: 'boolean' },
  },
  required: ['id', 'data', 'updatedAt', 'isDraft'],
};
