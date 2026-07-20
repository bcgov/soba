import { createDiskTempStorageAdapter } from '../../core/integrations/temp-storage/diskTempStorage';
import type {
  TempStorageAdapter,
  TempStoragePluginDefinition,
} from '../../core/integrations/temp-storage/TempStorageAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

const CODE = 'tempstorage-mount';

const DEFAULT_DIR = '/app/tmp';

/** Disk temp storage under a fixed DIR (default /app/tmp) — a shared RWX PVC for
 *  temp shared across replicas. Opt-in; the default is tempstorage-os. Config: DIR. */
function createMountTempStorageAdapter(config: PluginConfigReader): TempStorageAdapter {
  const dir = config.getOptional('DIR') ?? DEFAULT_DIR;
  return createDiskTempStorageAdapter(dir);
}

export const tempStoragePluginDefinition: TempStoragePluginDefinition = {
  code: CODE,
  createAdapter: createMountTempStorageAdapter,
};
