import { describe, it, expect } from 'vitest';
import { submissionDataSchema } from '@/lib/rxdb/submissionDataSchema';

describe('submissionDataSchema', () => {
  it('has version 0', () => {
    expect(submissionDataSchema.version).toBe(0);
  });

  it('uses id as primary key', () => {
    expect(submissionDataSchema.primaryKey).toBe('id');
  });

  it('requires id, data, updatedAt, and isDraft', () => {
    expect(submissionDataSchema.required).toEqual(['id', 'data', 'updatedAt', 'isDraft']);
  });

  it('id property is a string with uuid format and maxLength 36', () => {
    const idProp = submissionDataSchema.properties.id;
    expect(idProp.type).toBe('string');
    expect(idProp.format).toBe('uuid');
    expect(idProp.maxLength).toBe(36);
  });

  it('data property is a freeform object', () => {
    const dataProp = submissionDataSchema.properties.data;
    expect(dataProp.type).toBe('object');
  });

  it('isDraft property is a boolean', () => {
    const prop = submissionDataSchema.properties.isDraft;
    expect(prop.type).toBe('boolean');
  });

  it('updatedAt property has date-time format', () => {
    const prop = submissionDataSchema.properties.updatedAt;
    expect(prop.type).toBe('string');
    expect(prop.format).toBe('date-time');
    expect(prop.maxLength).toBe(30);
  });

  it('has exactly 4 properties', () => {
    expect(Object.keys(submissionDataSchema.properties)).toHaveLength(4);
  });
});
