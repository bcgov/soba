import { cleanFileName } from '../../core/fileNames';

/** The most characters kept before an extension. */
const NAME_MAX_CHARACTERS = 100;
/** The most UTF-8 bytes in a name, within the 255 most file systems take, with room to spare. */
const NAME_MAX_BYTES = 240;
/** Room for " (999)" when repeats are told apart. */
const COPY_SUFFIX_BYTES = 6;
/** A longer "extension" is part of the name. */
const EXTENSION_MAX_BYTES = 32;
/** Names Windows reserves for devices, with or without an extension. */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** `name` without the trailing dots and spaces Windows drops when it extracts a file. */
const trimTrailingDots = (name: string): string => {
  let end = name.length;
  while (end > 0 && (name[end - 1] === '.' || name[end - 1] === ' ')) end -= 1;
  return name.slice(0, end);
};

/** `text` cut to whole characters: at most 100, and at most `maxBytes` in UTF-8. */
const cut = (text: string, maxBytes: number): string => {
  const characters = Array.from(text).slice(0, NAME_MAX_CHARACTERS);
  while (characters.length > 0 && Buffer.byteLength(characters.join('')) > maxBytes) {
    characters.pop();
  }
  return characters.join('');
};

/**
 * `<form name> <confirmation code>`: the name of the package and of the document in it, leaving
 * room for a four-character extension.
 */
export const packageName = (formName: string, confirmationCode: string): string => {
  const room = NAME_MAX_BYTES - Buffer.byteLength(` ${confirmationCode}.zip`);
  return cleanFileName(`${cut(cleanFileName(formName), room) || 'Submission'} ${confirmationCode}`);
};

/** The rendered document's extension: pdf for a PDF, else txt. */
export const documentExtension = (contentType: string | undefined): string =>
  contentType?.toLowerCase().startsWith('application/pdf') ? 'pdf' : 'txt';

/** A name and its extension, dot included; a leading dot, or a very long extension, is the name. */
const splitExtension = (name: string): [string, string] => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || Buffer.byteLength(name.slice(dot)) > EXTENSION_MAX_BYTES) return [name, ''];
  return [name.slice(0, dot), name.slice(dot)];
};

/**
 * Names uploads for the package's `files/` folder, so each extracts as named on Windows, macOS and
 * Linux: cleaned, without trailing dots or spaces, a reserved device name prefixed with "_", cut to
 * 100 characters and 240 bytes before the extension, then told apart with " (2)", " (3)" before the
 * extension when two match, ignoring case as most file systems do. A name left empty becomes "file".
 */
export const uploadNamer = (): ((name: string) => string) => {
  const used = new Set<string>();
  return (raw) => {
    const trimmed = trimTrailingDots(cleanFileName(raw)) || 'file';
    const usable = WINDOWS_RESERVED.test(trimmed) ? `_${trimmed}` : trimmed;
    const [base, extension] = splitExtension(usable);
    const room = NAME_MAX_BYTES - COPY_SUFFIX_BYTES - Buffer.byteLength(extension);
    const stem = trimTrailingDots(cut(base, room)) || 'file';
    const nameFor = (copy: number): string => {
      const candidate = copy === 1 ? `${stem}${extension}` : `${stem} (${copy})${extension}`;
      return used.has(candidate.toLowerCase()) ? nameFor(copy + 1) : candidate;
    };
    const name = nameFor(1);
    used.add(name.toLowerCase());
    return name;
  };
};

/** Why an upload is not in the package. */
export type LeftOutReason = 'deleted' | 'too-large';

/** An upload left out of the package. */
export interface LeftOut {
  name: string;
  reason: LeftOutReason;
}

const REASONS: Record<LeftOutReason, (maxFileMb: number) => string> = {
  deleted: () => 'deleted / supprimé',
  'too-large': (maxFileMb) => `larger than ${maxFileMb} MB / plus de ${maxFileMb} Mo`,
};

/** The text of missing-files.txt: each upload left out and why, in English and French. */
export const missingFilesText = (leftOut: readonly LeftOut[], maxFileMb: number): string =>
  [
    'Uploaded files not in this package / Fichiers téléversés absents de ce paquet',
    '',
    ...leftOut.map(
      ({ name, reason }) => `${cleanFileName(name) || 'file'}: ${REASONS[reason](maxFileMb)}`,
    ),
    '',
  ].join('\n');
