import { scanUpload } from '../../../src/features/files/scanUpload';
import { isFeatureEnabledCached } from '../../../src/core/db/repos/featureRepo';
import { getVirusScanAdapter } from '../../../src/core/integrations/plugins/PluginRegistry';
import { virusScanPluginDefinition } from '../../../src/plugins/virusscan-noop';
import { createPluginConfigReader } from '../../../src/core/config/pluginConfig';
import type {
  ScanResult,
  VirusScanAdapter,
} from '../../../src/core/integrations/virus-scan/VirusScanAdapter';

jest.mock('../../../src/core/db/repos/featureRepo', () => ({
  isFeatureEnabledCached: jest.fn(),
}));
jest.mock('../../../src/core/integrations/plugins/PluginRegistry', () => ({
  getVirusScanAdapter: jest.fn(),
}));

const featureEnabled = isFeatureEnabledCached as jest.Mock;
const scannerGetter = getVirusScanAdapter as jest.Mock;

/** Adapter double that returns a fixed verdict from scanBuffer. */
function adapterReturning(result: ScanResult): VirusScanAdapter {
  return {
    scanStream: async () => result,
    scanBuffer: async () => result,
    scanFile: async () => result,
    ping: async () => true,
  };
}

const noopAdapter = virusScanPluginDefinition.createAdapter(
  createPluginConfigReader(virusScanPluginDefinition.code),
);

describe('scanUpload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes without scanning when the antivirus feature is off', async () => {
    featureEnabled.mockResolvedValue(false);

    await expect(scanUpload(Buffer.from('x'), 'f.txt')).resolves.toBe('clean');
    expect(scannerGetter).not.toHaveBeenCalled();
  });

  it('returns clean for a clean file when the feature is on', async () => {
    featureEnabled.mockResolvedValue(true);
    scannerGetter.mockReturnValue(noopAdapter);

    await expect(scanUpload(Buffer.from('x'), 'f.txt')).resolves.toBe('clean');
  });

  it('rejects an infected file', async () => {
    featureEnabled.mockResolvedValue(true);
    scannerGetter.mockReturnValue(
      adapterReturning({ verdict: 'infected', viruses: ['Eicar-Test'], scannerCode: 'fake' }),
    );

    await expect(scanUpload(Buffer.from('x'), 'f.txt')).resolves.toBe('infected');
  });

  it('fails closed when the scan verdict is error', async () => {
    featureEnabled.mockResolvedValue(true);
    scannerGetter.mockReturnValue(
      adapterReturning({ verdict: 'error', viruses: [], scannerCode: 'fake', message: 'down' }),
    );

    await expect(scanUpload(Buffer.from('x'), 'f.txt')).resolves.toBe('scan-unavailable');
  });

  it('fails closed when the scanner adapter throws', async () => {
    featureEnabled.mockResolvedValue(true);
    scannerGetter.mockImplementation(() => {
      throw new Error('no scanner installed');
    });

    await expect(scanUpload(Buffer.from('x'), 'f.txt')).resolves.toBe('scan-unavailable');
  });
});
