import type {
  ScanResult,
  VirusScanAdapter,
  VirusScanPluginDefinition,
} from '../../core/integrations/virus-scan/VirusScanAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

const CODE = 'virusscan-noop';

/** No-op scanner: reports everything clean. Default for local dev/tests so they
 *  run without ClamAV. Not for envs where uploads must be scanned. */
function createNoopVirusScanAdapter(config: PluginConfigReader): VirusScanAdapter {
  void config; // Required by interface; this plugin does not use config
  const clean = (): ScanResult => ({ verdict: 'clean', viruses: [], scannerCode: CODE });

  return {
    async scanStream(): Promise<ScanResult> {
      return clean();
    },
    async scanBuffer(): Promise<ScanResult> {
      return clean();
    },
    async scanFile(): Promise<ScanResult> {
      return clean();
    },
    async ping(): Promise<boolean> {
      return true;
    },
  };
}

export const virusScanPluginDefinition: VirusScanPluginDefinition = {
  code: CODE,
  createAdapter: createNoopVirusScanAdapter,
};
