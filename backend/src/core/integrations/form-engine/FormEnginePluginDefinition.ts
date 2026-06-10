import { PluginConfigReader } from '../../config/pluginConfig';
import { FormEngineAdapter } from './FormEngineAdapter';

export interface FormEngineMetadata {
  code: string;
  name: string;
  version?: string;
}

export interface FormEnginePluginDefinition {
  code: string;
  metadata: FormEngineMetadata;
  createAdapter: (config: PluginConfigReader) => FormEngineAdapter;
}
