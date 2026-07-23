import { PluginConfigReader } from '../../config/pluginConfig';
import { DocumentGenerationAdapter } from './DocumentGenerationAdapter';

export interface DocumentGenerationMetadata {
  code: string;
  name: string;
  version?: string;
}

export interface DocumentGenerationPluginDefinition {
  code: string;
  metadata: DocumentGenerationMetadata;
  createAdapter: (config: PluginConfigReader) => DocumentGenerationAdapter;
  /**
   * Feature that gates this backend's availability (see soba.feature). A `scoped` feature makes the
   * backend available only where granted; absent means the backend is always selectable.
   */
  featureCode?: string;
}
