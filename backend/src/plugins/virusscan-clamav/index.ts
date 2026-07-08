import { Readable } from 'stream';
import NodeClam from 'clamscan';
import { parseNumberEnvValue } from '../../core/config/env';
import type {
  ScanResult,
  VirusScanAdapter,
  VirusScanPluginDefinition,
} from '../../core/integrations/virus-scan/VirusScanAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

const CODE = 'virusscan-clamav';

const DEFAULT_URL = 'localhost:3310';
const DEFAULT_PORT = 3310;
const DEFAULT_TIMEOUT_MS = 60000;

interface ClamScanResponse {
  isInfected: boolean | null;
  viruses: string[];
}

/** clamd is raw TCP, not HTTP — the "URL" is a host:port endpoint. Tolerates a
 *  tcp:// scheme and trailing path; missing port falls back to defaultPort. */
export function parseClamavUrl(raw: string, defaultPort: number): { host: string; port: number } {
  const withoutScheme = raw.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const hostPort = withoutScheme.split('/')[0];
  const colon = hostPort.lastIndexOf(':');
  if (colon === -1) return { host: hostPort, port: defaultPort };
  return { host: hostPort.slice(0, colon), port: parseNumberEnvValue(hostPort.slice(colon + 1)) };
}

/** clamscan surfaces a detection as a rejected promise carrying the virus list. */
function resultFromError(err: unknown): ScanResult | null {
  const data = (err as { data?: { viruses?: string[] } })?.data;
  if (data && Array.isArray(data.viruses) && data.viruses.length > 0) {
    return { verdict: 'infected', viruses: data.viruses, scannerCode: CODE };
  }
  return null;
}

function toScanResult(res: ClamScanResponse): ScanResult {
  if (res.isInfected) {
    return { verdict: 'infected', viruses: res.viruses ?? [], scannerCode: CODE };
  }
  return { verdict: 'clean', viruses: [], scannerCode: CODE };
}

function createClamavVirusScanAdapter(config: PluginConfigReader): VirusScanAdapter {
  const { host, port } = parseClamavUrl(config.getOptional('URL') ?? DEFAULT_URL, DEFAULT_PORT);
  const timeoutRaw = config.getOptional('TIMEOUT_MS');
  const timeout = timeoutRaw ? parseNumberEnvValue(timeoutRaw) : DEFAULT_TIMEOUT_MS;

  // Remote clamd over TCP; no local-binary fallback.
  const initOptions: NodeClam.Options = {
    clamdscan: { host, port, timeout, localFallback: false },
    preference: 'clamdscan',
  };

  // Memoize the client; clear a failed init so the next call retries.
  let clamPromise: Promise<NodeClam> | null = null;
  const getClam = (): Promise<NodeClam> => {
    if (!clamPromise) {
      clamPromise = new NodeClam().init(initOptions).catch((err) => {
        clamPromise = null;
        throw err;
      });
    }
    return clamPromise;
  };

  const errorResult = (err: unknown): ScanResult => ({
    verdict: 'error',
    viruses: [],
    scannerCode: CODE,
    message: err instanceof Error ? err.message : String(err),
  });

  const runScan = async (stream: Readable): Promise<ScanResult> => {
    try {
      const clam = await getClam();
      const res = (await clam.scanStream(stream)) as ClamScanResponse;
      return toScanResult(res);
    } catch (err) {
      return resultFromError(err) ?? errorResult(err);
    }
  };

  return {
    scanStream(stream: Readable): Promise<ScanResult> {
      return runScan(stream);
    },

    scanBuffer(data: Buffer): Promise<ScanResult> {
      return runScan(Readable.from(data));
    },

    async scanFile(path: string): Promise<ScanResult> {
      try {
        const clam = await getClam();
        const res = (await clam.scanFile(path)) as ClamScanResponse;
        return toScanResult(res);
      } catch (err) {
        return resultFromError(err) ?? errorResult(err);
      }
    },

    async ping(): Promise<boolean> {
      try {
        const clam = await getClam();
        const socket = await clam.ping();
        socket.destroy();
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const virusScanPluginDefinition: VirusScanPluginDefinition = {
  code: CODE,
  createAdapter: createClamavVirusScanAdapter,
};
