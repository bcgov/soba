import { validate as isUuid } from 'uuid';
import { isRecord } from './records';

/** A file uploaded with a submission, as its answers hold it. */
export type UploadRef = Record<string, unknown> & { storage: 'chefs'; id: string };

/**
 * Whether an answer is an uploaded file. An upload's `id` is always a UUID; other answers named
 * `storage` and `id` rarely are.
 */
export const isUploadRef = (value: unknown): value is UploadRef =>
  isRecord(value) && value.storage === 'chefs' && typeof value.id === 'string' && isUuid(value.id);

/** An upload in a submission's answers: its file's id and the name the answers give it, if any. */
export interface UploadInAnswers {
  id: string;
  name: string | null;
}

const nameOf = (upload: UploadRef): string | null => {
  const name = upload.originalName ?? upload.name;
  return typeof name === 'string' && name.trim() !== '' ? name : null;
};

const collect = (value: unknown, found: Map<string, UploadInAnswers>): void => {
  if (Array.isArray(value)) {
    value.forEach((item) => collect(item, found));
    return;
  }
  if (!isRecord(value)) return;
  if (isUploadRef(value)) {
    if (!found.has(value.id)) found.set(value.id, { id: value.id, name: nameOf(value) });
    return;
  }
  Object.values(value).forEach((child) => collect(child, found));
};

/**
 * Each file uploaded with the answers, once each, in order of appearance, wherever it sits: file
 * components can be inside panels, columns and data grids.
 */
export const uploadsIn = (answers: unknown): UploadInAnswers[] => {
  const found = new Map<string, UploadInAnswers>();
  collect(answers, found);
  return [...found.values()];
};
