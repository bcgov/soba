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
}
