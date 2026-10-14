import type { UserDirectoryPluginDefinition } from '../../core/integrations/user-directory/UserDirectoryPluginDefinition';
import { CssAdapter } from './cssAdapter';
export const userDirectoryPluginDefinition: UserDirectoryPluginDefinition = {
  code: 'css-v1',
  metadata: { code: 'css-v1', name: 'CSS user directory', version: 'v1' },
  createAdapter: (config) => new CssAdapter(config),
};
