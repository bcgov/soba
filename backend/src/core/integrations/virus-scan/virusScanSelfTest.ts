import type { VirusScanAdapter } from './VirusScanAdapter';

// EICAR test signature, assembled at runtime so this file doesn't trip endpoint AV.
const EICAR_TEST_STRING = [
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}',
  '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!',
  '$H+H*',
].join('');

export interface VirusScanSelfTestResult {
  scannerCode: string;
  /** Reachable — says nothing about definitions. */
  connected: boolean;
  verdict: 'clean' | 'infected' | 'error';
  viruses: string[];
  message?: string;
  /** connected and EICAR detected. */
  healthy: boolean;
}

/** Ping, then scan EICAR — separates reachable from actually-detecting. Never
 *  throws. noop returns clean, so healthy is false for it. */
export async function virusScanSelfTest(
  adapter: VirusScanAdapter,
): Promise<VirusScanSelfTestResult> {
  const connected = await adapter.ping().catch(() => false);
  const scan = await adapter.scanBuffer(Buffer.from(EICAR_TEST_STRING), { filename: 'eicar.txt' });
  return {
    scannerCode: scan.scannerCode,
    connected,
    verdict: scan.verdict,
    viruses: scan.viruses,
    message: scan.message,
    healthy: connected && scan.verdict === 'infected',
  };
}
