import { describe, it, expect } from 'vitest';
import { workspaceSchema } from '@/lib/rxdb/workspaceSchema';

describe('workspaceSchema', () => {
  it('has version 0', () => {
    expect(workspaceSchema.version).toBe(0);
  });

  it('uses id as primary key', () => {
    expect(workspaceSchema.primaryKey).toBe('id');
  });

  it('requires all mandatory fields', () => {
    expect(workspaceSchema.required).toEqual([
      'id',
      'name',
      'kind',
      'role',
      'status',
      'disclaimerAccepted',
      'updatedAt',
    ]);
  });

  it('defines indexes on name and updatedAt', () => {
    expect(workspaceSchema.indexes).toEqual(['name', 'updatedAt']);
  });

  it('id property is a string with uuid format and maxLength 36', () => {
    const idProp = workspaceSchema.properties.id;
    expect(idProp.type).toBe('string');
    expect(idProp.format).toBe('uuid');
    expect(idProp.maxLength).toBe(36);
  });

  it('name property is a string with maxLength 255', () => {
    const nameProp = workspaceSchema.properties.name;
    expect(nameProp.type).toBe('string');
    expect(nameProp.maxLength).toBe(255);
  });

  it('disclaimerAccepted property is a boolean', () => {
    const prop = workspaceSchema.properties.disclaimerAccepted;
    expect(prop.type).toBe('boolean');
  });

  it('updatedAt property has date-time format', () => {
    const prop = workspaceSchema.properties.updatedAt;
    expect(prop.type).toBe('string');
    expect(prop.format).toBe('date-time');
  });

  it('has exactly 7 properties', () => {
    expect(Object.keys(workspaceSchema.properties)).toHaveLength(7);
  });
});
