import os from 'node:os';
import path from 'node:path';
import { createDiskTempStorageAdapter } from '../../core/integrations/temp-storage/diskTempStorage';
import type {
  TempStorageAdapter,
  TempStoragePluginDefinition,
} from '../../core/integrations/temp-storage/TempStorageAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

const CODE = 'tempstorage-os';

/** Disk temp storage under os.tmpdir()/SUBDIR (default "soba"). Per-pod, no PVC
 *  — the default; deployments needing temp shared across replicas override to
 *  tempstorage-mount. Config: SUBDIR. */
function createOsTempStorageAdapter(config: PluginConfigReader): TempStorageAdapter {
  const subdir = config.getOptional('SUBDIR') ?? 'soba';
  return createDiskTempStorageAdapter(path.join(os.tmpdir(), subdir));
}

export const tempStoragePluginDefinition: TempStoragePluginDefinition = {
  code: CODE,
  createAdapter: createOsTempStorageAdapter,
};
