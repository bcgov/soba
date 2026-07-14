import { getVirusScanAdapter } from '../../core/integrations/plugins/PluginRegistry';
import { isFeatureEnabledCached } from '../../core/db/repos/featureRepo';
import { Features } from '../../core/db/codes';
import { log } from '../../core/logging';

/** 'clean' proceeds to storage; 'infected'/'scan-unavailable' reject the upload. */
export type ScanOutcome = 'clean' | 'infected' | 'scan-unavailable';

/**
 * Scan the incoming bytes when the antivirus feature is enabled. Fail-closed: a scanner that can't
 * complete (verdict 'error', or the adapter itself throwing) rejects the upload rather than letting
 * an unscanned file through. When the feature is off, uploads pass without scanning.
 */
export async function scanUpload(buffer: Buffer, filename: string): Promise<ScanOutcome> {
  const enabled = await isFeatureEnabledCached(Features.antivirus, Date.now());
  if (!enabled) return 'clean';

  try {
    const result = await getVirusScanAdapter().scanBuffer(buffer, { filename });
    if (result.verdict === 'infected') {
      log.warn(
        { filename, viruses: result.viruses, scannerCode: result.scannerCode },
        'Upload rejected: virus detected',
      );
      return 'infected';
    }
    if (result.verdict === 'error') {
      log.error(
        { filename, scannerCode: result.scannerCode, message: result.message },
        'Upload rejected: virus scan could not complete (fail-closed)',
      );
      return 'scan-unavailable';
    }
    return 'clean';
  } catch (err) {
    log.error({ err, filename }, 'Upload rejected: virus scanner unavailable (fail-closed)');
    return 'scan-unavailable';
  }
}
