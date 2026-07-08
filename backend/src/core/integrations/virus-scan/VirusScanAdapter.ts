/**
 * Pluggable virus-scan adapter. Implementations are provided by plugins
 * (e.g. virusscan-clamav, virusscan-noop) and selected via VIRUSSCAN_DEFAULT_CODE.
 */
import type { Readable } from 'node:stream';
import type { PluginConfigReader } from '../../config/pluginConfig';

/** Outcome of a scan. `error` means the scan could not complete (verdict is unknown). */
export type ScanVerdict = 'clean' | 'infected' | 'error';

export interface ScanResult {
  verdict: ScanVerdict;
  /** Signature names when infected; empty otherwise. */
  viruses: string[];
  /** Code of the plugin that produced the result. */
  scannerCode: string;
  /** Human-readable detail, primarily for the `error` verdict. */
  message?: string;
}

export interface ScanOptions {
  /** Original filename, used only for logging/result context. */
  filename?: string;
}

export interface VirusScanAdapter {
  scanStream(stream: Readable, opts?: ScanOptions): Promise<ScanResult>;
  scanBuffer(data: Buffer, opts?: ScanOptions): Promise<ScanResult>;
  scanFile(path: string, opts?: ScanOptions): Promise<ScanResult>;
  /** Liveness check against the scanner backend. Used by readiness reporting. */
  ping(): Promise<boolean>;
}

export interface VirusScanPluginDefinition {
  code: string;
  createAdapter: (config: PluginConfigReader) => VirusScanAdapter;
}
