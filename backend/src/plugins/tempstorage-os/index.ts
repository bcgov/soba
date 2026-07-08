import os from 'os';
import path from 'path';
import { createDiskTempStorageAdapter } from '../../core/integrations/temp-storage/diskTempStorage';
import type {
  TempStorageAdapter,
  TempStoragePluginDefinition,
} from '../../core/integrations/temp-storage/TempStorageAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

const CODE = 'tempstorage-os';

/**
 * Disk temp storage under the OS temp directory (os.tmpdir()). Fine for a single
 * pod or local dev; deployments that scale horizontally should use
 * tempstorage-mount against a shared volume instead.
 * Config: SUBDIR (optional) names the subdirectory under os.tmpdir() (default "soba").
 */
function createOsTempStorageAdapter(config: PluginConfigReader): TempStorageAdapter {
  const subdir = config.getOptional('SUBDIR') ?? 'soba';
  return createDiskTempStorageAdapter(path.join(os.tmpdir(), subdir));
}

export const tempStoragePluginDefinition: TempStoragePluginDefinition = {
  code: CODE,
  createAdapter: createOsTempStorageAdapter,
};
