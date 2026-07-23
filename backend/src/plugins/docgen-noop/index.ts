import type { PluginConfigReader } from '../../core/config/pluginConfig';
import type {
  DocumentGenerationAdapter,
  DocumentRenderResult,
} from '../../core/integrations/document-generation/DocumentGenerationAdapter';
import type { DocumentGenerationPluginDefinition } from '../../core/integrations/document-generation/DocumentGenerationPluginDefinition';

const CODE = 'docgen-noop';

// Stand-in for a rendered document so local dev/tests run without a real generator.
const PLACEHOLDER = Buffer.from('document generation is disabled (docgen-noop backend)\n');

/** No-op document generator: returns a placeholder document, no external call. Dev/test only. */
function createNoopDocumentGenerationAdapter(
  config: PluginConfigReader,
): DocumentGenerationAdapter {
  void config; // Required by interface; this plugin does not use config
  return {
    async render(): Promise<DocumentRenderResult> {
      return { data: PLACEHOLDER, contentType: 'text/plain' };
    },
  };
}

export const documentGenerationPluginDefinition: DocumentGenerationPluginDefinition = {
  code: CODE,
  metadata: {
    code: CODE,
    name: 'No-op document generator',
  },
  createAdapter: createNoopDocumentGenerationAdapter,
};
