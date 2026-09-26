import { getStorageAdapter } from '../integrations/plugins/PluginRegistry';
import {
  createFileRecord,
  deleteFileRecord,
  type FileLinkWrite,
  type FileRecord,
} from '../db/repos/fileRepo';
import type { GetFileResult } from '../integrations/storage-engine/StorageEngineAdapter';
import { scanUpload, type ScanOutcome } from './scanUpload';
import { ServiceUnavailableError, UnprocessableEntityError } from '../errors';

export interface StoreFileInput {
  workspaceId: string;
  actorId: string;
  /** Storage profile of the owning feature. */
  profile: string;
  filename: string;
  contentType?: string;
  size?: number;
  buffer: Buffer;
}

/** The stored file, or the scan outcome that refused it. */
export type StoreFileOutcome = FileRecord | Exclude<ScanOutcome, 'clean'>;

/** The stored file, or the API error for a scan that refused it. */
export function storedOrThrow(outcome: StoreFileOutcome): FileRecord {
  // Infected is a problem with the content; scan-unavailable fails closed, so nothing is stored.
  if (outcome === 'infected') throw new UnprocessableEntityError('File failed virus scan');
  if (outcome === 'scan-unavailable') {
    throw new ServiceUnavailableError('Virus scanning unavailable');
  }
  return outcome;
}

/** Stored files for every feature. */
export const fileStore = {
  /**
   * Scan, store the bytes, then record the file and its link. An infected or unscannable file never
   * reaches storage or the database.
   */
  async put(input: StoreFileInput, link: FileLinkWrite): Promise<StoreFileOutcome> {
    const scan = await scanUpload(input.buffer, input.filename);
    if (scan !== 'clean') return scan;

    const adapter = getStorageAdapter(input.profile);
    const result = await adapter.uploadFile({
      workspaceId: input.workspaceId,
      filename: input.filename,
      contentType: input.contentType,
      size: input.size,
      buffer: input.buffer,
    });
    try {
      return await createFileRecord(
        {
          workspaceId: input.workspaceId,
          profile: input.profile,
          backendRef: result.engineFileRef,
          filename: input.filename,
          contentType: input.contentType ?? null,
          size: input.size ?? null,
          createdBy: input.actorId,
        },
        link,
      );
    } catch (err) {
      // Storage and DB can't share a transaction; drop the stored bytes when the rows fail.
      // deleteFile swallows its own errors.
      await adapter.deleteFile(result.engineFileRef);
      throw err;
    }
  },

  /** The file's metadata and, when the backend offers one, a download stream. Null when gone. */
  open(record: FileRecord): Promise<GetFileResult | null> {
    return getStorageAdapter(record.profile).getFile(record.backendRef);
  },

  /** Rows first, then bytes: a failed byte delete leaves a reclaimable orphan. */
  async remove(record: FileRecord, unlink: FileLinkWrite): Promise<void> {
    await deleteFileRecord(record, unlink);
    await getStorageAdapter(record.profile).deleteFile(record.backendRef);
  },
};
