import { createDiskTempStorageAdapter } from '../../core/integrations/temp-storage/diskTempStorage';
import type {
  TempStorageAdapter,
  TempStoragePluginDefinition,
} from '../../core/integrations/temp-storage/TempStorageAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

const CODE = 'tempstorage-mount';

const DEFAULT_DIR = '/app/tmp';

/**
 * Disk temp storage under a fixed mount directory — in deployments this is a
 * shared (RWX) PVC, so it survives horizontal scaling and never touches
 * os.tmpdir(). Config: DIR sets the mount path (default /app/tmp).
 */
function createMountTempStorageAdapter(config: PluginConfigReader): TempStorageAdapter {
  const dir = config.getOptional('DIR') ?? DEFAULT_DIR;
  return createDiskTempStorageAdapter(dir);
}

export const tempStoragePluginDefinition: TempStoragePluginDefinition = {
  code: CODE,
  createAdapter: createMountTempStorageAdapter,
};
