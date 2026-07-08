import type {
  ScanResult,
  VirusScanAdapter,
  VirusScanPluginDefinition,
} from '../../core/integrations/virus-scan/VirusScanAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

const CODE = 'virusscan-noop';

/**
 * No-op scanner: reports everything clean without contacting a backend.
 * This is the default so local dev and tests run without a ClamAV service.
 * Never select this in an environment where uploads must actually be scanned —
 * production deployments set VIRUSSCAN_DEFAULT_CODE=virusscan-clamav.
 */
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
