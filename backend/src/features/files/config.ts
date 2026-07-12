import path from 'node:path';
import { env } from '../../core/config/env';

/**
 * Extensions rejected on upload regardless of a form's fileTypes. Enforced server-side; also sent
 * to the client via GET /meta/files-config so it can block them before upload.
 */
export const BLOCKED_FILE_EXTENSIONS: readonly string[] = [
  '.exe',
  '.bat',
  '.scr',
  '.com',
  '.pif',
  '.cmd',
  '.jar',
  '.app',
  '.deb',
  '.dmg',
  '.msi',
  '.run',
  '.bin',
  '.sh',
  '.ps1',
  '.vbs',
  '.js',
  '.html',
  '.php',
  '.py',
  '.rb',
];

export interface FilesConfig {
  /** Max upload size in MB (mirrors the multer limit; from FILES_MAX_FILE_SIZE_MB). */
  maxFileSizeMb: number;
  /** Extensions the client should block regardless of the form's fileTypes. */
  blockedExtensions: string[];
}

/** Client-facing files config: the upload size limit and the always-blocked extensions. */
export function getFilesConfig(): FilesConfig {
  return {
    maxFileSizeMb: env.getFilesMaxFileSizeMb(),
    blockedExtensions: [...BLOCKED_FILE_EXTENSIONS],
  };
}

/** True when the filename's extension is on the always-blocked list (case-insensitive). */
export function isBlockedExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext !== '' && BLOCKED_FILE_EXTENSIONS.includes(ext);
}
