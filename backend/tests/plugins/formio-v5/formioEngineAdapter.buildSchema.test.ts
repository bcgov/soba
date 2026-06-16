import {
  stripEngineManagedFields,
  buildSchemaBody,
} from '../../../src/plugins/formio-v5/formioEngineAdapter';

describe('FormioEngineAdapter schema helpers', () => {
  it('stripEngineManagedFields removes engine-managed fields and keeps the rest', () => {
    const result = stripEngineManagedFields({
      _id: 'eng-1',
      machineName: 'soba-v1',
      created: 'c',
      modified: 'm',
      owner: 'o',
      project: 'p',
      display: 'form',
      components: [{ key: 'a' }],
      properties: { foo: 'bar' },
    });

    expect(result).toEqual({
      display: 'form',
      components: [{ key: 'a' }],
      properties: { foo: 'bar' },
    });
  });

  it('stripEngineManagedFields returns a clone and does not mutate the input', () => {
    const input = { _id: 'eng-1', display: 'form' };
    const result = stripEngineManagedFields(input);
    expect(input._id).toBe('eng-1'); // input untouched
    expect(result).not.toBe(input);
    expect('_id' in result).toBe(false);
  });

  it('buildSchemaBody applies deterministic identity + SOBA metadata, preserving content', () => {
    const body = buildSchemaBody({
      formVersionId: 'v1',
      workspaceId: 'ws1',
      title: 'My Form',
      schema: { display: 'form', components: [{ key: 'a' }], tags: ['keep-me'] },
    });

    expect(body.name).toBe('soba-v1');
    expect(body.path).toBe('soba-v1');
    expect(body.title).toBe('My Form');
    expect(body.display).toBe('form');
    expect(body.components).toEqual([{ key: 'a' }]);
    expect(body.tags).toEqual(expect.arrayContaining(['soba', 'ws1', 'keep-me']));
    expect(body.properties).toEqual({ soba_workspace_id: 'ws1', soba_form_version_id: 'v1' });
  });

  it('buildSchemaBody strips engine-managed fields from the input schema', () => {
    const body = buildSchemaBody({
      formVersionId: 'v1',
      workspaceId: 'ws1',
      schema: { _id: 'old-id', machineName: 'old', created: 'x', components: [] },
    });

    expect(body._id).toBeUndefined();
    expect(body.machineName).toBeUndefined();
    expect(body.created).toBeUndefined();
  });

  it('buildSchemaBody does not mutate the input schema', () => {
    const schema = { _id: 'old-id', display: 'form' };
    buildSchemaBody({ formVersionId: 'v1', workspaceId: 'ws1', schema });
    expect(schema._id).toBe('old-id'); // input untouched
  });

  it('buildSchemaBody title falls back to the schema title, then to "Form"', () => {
    const fromSchema = buildSchemaBody({
      formVersionId: 'v1',
      workspaceId: 'ws1',
      schema: { title: 'Schema Title' },
    });
    expect(fromSchema.title).toBe('Schema Title');

    const fallback = buildSchemaBody({ formVersionId: 'v1', workspaceId: 'ws1', schema: {} });
    expect(fallback.title).toBe('Form');
  });

  it('buildSchemaBody merges SOBA tags with existing tags without duplicates', () => {
    const body = buildSchemaBody({
      formVersionId: 'v1',
      workspaceId: 'ws1',
      schema: { tags: ['soba', 'custom'] },
    });
    const tags = body.tags as string[];
    expect(tags.filter((t) => t === 'soba')).toHaveLength(1);
    expect(tags).toEqual(expect.arrayContaining(['soba', 'ws1', 'custom']));
  });
});
