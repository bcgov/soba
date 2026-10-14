import type { PluginConfigReader } from '../../config/pluginConfig';
import type { UserDirectoryAdapter } from './UserDirectoryAdapter';

export interface UserDirectoryMetadata {
  code: string;
  name: string;
  version?: string;
}

export interface UserDirectoryPluginDefinition {
  code: string;
  metadata: UserDirectoryMetadata;
  createAdapter: (config: PluginConfigReader) => UserDirectoryAdapter;
}
