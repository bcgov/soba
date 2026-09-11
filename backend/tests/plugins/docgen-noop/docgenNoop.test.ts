import { documentGenerationPluginDefinition } from '../../../src/plugins/docgen-noop';
import { createPluginConfigReader } from '../../../src/core/config/pluginConfig';

describe('docgen-noop', () => {
  const adapter = documentGenerationPluginDefinition.createAdapter(
    createPluginConfigReader(documentGenerationPluginDefinition.code),
  );

  it('has the expected code', () => {
    expect(documentGenerationPluginDefinition.code).toBe('docgen-noop');
  });

  it('returns a placeholder document without an external call', async () => {
    const res = await adapter.render({ template: { content: 'x' } });
    expect(res.contentType).toBe('text/plain');
    expect(res.data.length).toBeGreaterThan(0);
  });
});
