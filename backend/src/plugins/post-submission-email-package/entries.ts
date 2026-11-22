import { cleanFileName } from '../../core/fileNames';

/** The most characters kept in a name before its extension. */
const NAME_MAX_CHARACTERS = 100;
/** The most UTF-8 bytes in a name, within the 255 most file systems take, with room to spare. */
const NAME_MAX_BYTES = 240;
/** A longer "extension" is part of the name. */
const EXTENSION_MAX_BYTES = 32;

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

/** A name and its extension, dot included; a leading dot, or a very long extension, is the name. */
const splitExtension = (name: string): [string, string] => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || Buffer.byteLength(name.slice(dot)) > EXTENSION_MAX_BYTES) return [name, ''];
  return [name.slice(0, dot), name.slice(dot)];
};

/** `name` cleaned and cut to fit before `suffix`, without trailing dots; `fallback` when empty. */
const fitted = (name: string, suffix: string, fallback: string): string =>
  trimTrailingDots(cut(cleanFileName(name), NAME_MAX_BYTES - Buffer.byteLength(suffix))) ||
  fallback;

/** `<form name>-<confirmation code>`, the package's name before `.zip`. */
export const packageName = (formName: string, confirmationCode: string): string => {
  const code = `-${confirmationCode}`;
  return fitted(formName, `${code}.zip`, 'Submission') + code;
};

/** The rendered document's extension: pdf for a PDF, else txt. */
export const documentExtension = (contentType: string | undefined): string =>
  contentType?.toLowerCase().startsWith('application/pdf') ? 'pdf' : 'txt';

/**
 * `<template name>-<confirmation code>.<extension>`: the document is named after the template it
 * was rendered from, so the people who name templates decide how documents sort and group.
 */
export const reportName = (
  templateFilename: string,
  confirmationCode: string,
  contentType: string | undefined,
): string => {
  const suffix = `-${confirmationCode}.${documentExtension(contentType)}`;
  const [template] = splitExtension(templateFilename);
  return `${fitted(template, suffix, 'Submission')}${suffix}`;
};

/**
 * `<position>-<original name>` for an upload in the package's `attachments/` folder. The position,
 * from 1, keeps every name apart and keeps them in the order the form shows them. Cleaned, without
 * trailing dots or spaces, and cut to 100 characters and 240 bytes before the extension; a name
 * left empty becomes "file".
 */
export const attachmentName = (position: number, originalName: string): string => {
  const prefix = `${position}-`;
  const [base, extension] = splitExtension(trimTrailingDots(cleanFileName(originalName)));
  const stem = fitted(base, `${prefix}${extension}`, 'file');
  return `${prefix}${stem}${extension}`;
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
