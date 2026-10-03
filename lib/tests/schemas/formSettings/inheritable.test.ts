import { z } from 'zod';
import { inheritableSettingsSchemas } from '../../../src/schemas/formSettings';

const schemas = inheritableSettingsSchemas(z.object({ colour: z.enum(['red', 'blue']) }));

describe('inheritableSettingsSchemas', () => {
  it.each([
    ['inherit', { inherit: true }],
    ['own values', { inherit: false, values: { colour: 'red' } }],
  ])('accepts a form body that chooses %s', (_label, body) => {
    expect(schemas.formBody.safeParse(body).success).toBe(true);
  });

  // Mixing the two choices would leave one of them silently ignored.
  it.each([
    ['inherit with values', { inherit: true, values: { colour: 'red' } }],
    ['own values missing', { inherit: false }],
    ['own values that fail the group schema', { inherit: false, values: { colour: 'green' } }],
    ['no choice', {}],
  ])('refuses a form body with %s', (_label, body) => {
    expect(schemas.formBody.safeParse(body).success).toBe(false);
  });

  it('reads a form that inherits, with no values of its own', () => {
    const read = {
      inherit: true,
      own: null,
      workspace: { colour: 'blue' },
      effective: { colour: 'blue' },
    };
    expect(schemas.form.parse(read)).toEqual(read);
  });

  it('uses the group schema for the workspace values', () => {
    expect(schemas.workspace.safeParse({ colour: 'red' }).success).toBe(true);
    expect(schemas.workspace.safeParse({}).success).toBe(false);
  });
});
