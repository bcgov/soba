import { randomInt } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { type Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { PostSubmissionEmailPackageOptions } from '@soba/lib';
import {
  JobCancelledError,
  JobDeferredError,
  JobFailedError,
  type PostSubmissionActionContext,
  type PostSubmissionActionRenderStop,
} from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import type { TempResource } from '../../core/integrations/temp-storage/TempStorageAdapter';
import { type UploadInAnswers, uploadsIn } from '../../core/submissionUploads';
import { attachmentName, type LeftOut, missingFilesText, packageName, reportName } from './entries';
import type { PackageSettings } from './settings';
import { openZip, type ZipWriter } from './zip';

const MB = 1024 * 1024;

export const NO_ANSWERS = 'The submitted revision has no answers';
export const PACKAGE_NOT_WRITTEN = 'The package could not be written';
export const PACKAGE_NOT_STORED = 'The package could not be stored';
export const TEMP_STORAGE_UNAVAILABLE = 'Temp storage is unavailable';

/** The message a package over `limitBytes` ends dead with. */
export const packageTooLarge = (limitBytes: number): string =>
  `The package is over its size limit of ${limitBytes} bytes`;

/** How long a build waits while every render slot is taken. */
export const RENDER_BUSY_DELAY_MS = 60_000;
/** Up to this much more, so builds that waited together do not all return at once. */
export const RENDER_BUSY_SPREAD_MS = 30_000;

type Context = PostSubmissionActionContext<PostSubmissionEmailPackageOptions>;

/** How a render that did not produce a document ends the attempt. */
const RENDER_STOPS: Record<PostSubmissionActionRenderStop, () => Error> = {
  'no-template': () => new JobCancelledError('No document template on the form version'),
  unavailable: () => new JobCancelledError('No document generation for the form'),
  busy: () =>
    new JobDeferredError(
      RENDER_BUSY_DELAY_MS + randomInt(RENDER_BUSY_SPREAD_MS),
      'Document generation is busy',
    ),
  refused: () => new JobFailedError('The template could not be rendered'),
  failed: () => new Error('The document could not be rendered'),
};

/** Thrown inside a copy that passed the file limit. */
class TooLarge extends Error {}

/** Logs a failure by its class only, then throws `message`, so the attempt retries. */
const failWith = ({ log }: Context, err: unknown, message: string, logMessage: string): never => {
  log.warn({ error: err instanceof Error ? err.name : 'Error' }, logMessage);
  throw new Error(message);
};

/**
 * Runs a read or write of the package's bytes. A failure throws a fixed message, so the attempt
 * retries without passing on what storage, the file system or the zip said.
 */
const writing = async <T>(context: Context, run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (err) {
    if (context.signal.aborted || err instanceof TooLarge) throw err;
    return failWith(context, err, PACKAGE_NOT_WRITTEN, 'Package not written');
  }
};

/** A temp file to write; a failure to set one up throws a fixed message. */
const reserve = (context: Context, prefix: string): TempResource => {
  try {
    return context.services.tempStorage.reserve({ prefix });
  } catch (err) {
    return failWith(context, err, TEMP_STORAGE_UNAVAILABLE, 'Temp storage unavailable');
  }
};

/** What the package holds so far. */
interface Packing {
  zip: ZipWriter;
  limitBytes: number;
  maxFileBytes: number;
  bytes: number;
  leftOut: LeftOut[];
  staged: TempResource[];
  /** Uploads added so far; the next one's position is one more. */
  attached: number;
}

/** An upload staged to learn its size, or one that passed the file limit while staging. */
type Staged = { stream: Readable; size: number; resource: TempResource } | 'too-large';

/** Copies an upload whose size storage does not know to temp storage, to learn it. */
const stage = async (context: Context, packing: Packing, stream: Readable): Promise<Staged> => {
  const resource = reserve(context, 'package-upload');
  packing.staged.push(resource);
  let size = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      callback(size > packing.maxFileBytes ? new TooLarge() : null, chunk);
    },
  });
  try {
    await writing(context, () =>
      pipeline(stream, counter, createWriteStream(resource.path), { signal: context.signal }),
    );
  } catch (err) {
    if (err instanceof TooLarge) return 'too-large';
    throw err;
  }
  return { stream: createReadStream(resource.path), size, resource };
};

/** Removes the staged copies, the moment each is no longer read. */
const unstage = async (context: Context, packing: Packing) => {
  const staged = packing.staged.splice(0);
  await Promise.all(staged.map((resource) => context.services.tempStorage.remove(resource)));
};

/**
 * Adds one upload, or lists it as left out; a package that would pass its limit ends dead. An
 * upload goes by the name it had when it was uploaded, as the answers keep it; storage's name for
 * it only when the answers have none.
 */
const addUpload = async (context: Context, packing: Packing, upload: UploadInAnswers) => {
  const opened = await context.services.files.open(upload.id);
  if (opened === 'missing') {
    packing.leftOut.push({ name: upload.name ?? 'file', reason: 'deleted' });
    return;
  }
  const originalName = upload.name ?? opened.filename;
  let entryStream: Readable | undefined;
  try {
    const sized =
      opened.size === null
        ? await stage(context, packing, opened.stream)
        : { stream: opened.stream, size: opened.size };
    if (sized === 'too-large' || sized.size > packing.maxFileBytes) {
      packing.leftOut.push({ name: originalName, reason: 'too-large' });
      return;
    }
    entryStream = sized.stream;
    if (packing.bytes + sized.size > packing.limitBytes) {
      throw new JobFailedError(packageTooLarge(packing.limitBytes));
    }
    const name = `attachments/${attachmentName(packing.attached + 1, originalName)}`;
    await writing(context, () => packing.zip.addStream(sized.stream, name, sized.size));
    packing.bytes += sized.size;
    packing.attached += 1;
  } finally {
    opened.stream.destroy();
    entryStream?.destroy();
    await unstage(context, packing);
  }
};

/** Adds the uploads one at a time, so only one is open at once, reporting each. */
const addUploads = async (
  context: Context,
  packing: Packing,
  uploads: readonly UploadInAnswers[],
  index = 0,
): Promise<void> => {
  if (index === uploads.length) return;
  context.signal.throwIfAborted();
  await addUpload(context, packing, uploads[index]);
  context.reportProgress(index + 2, uploads.length + 1);
  return addUploads(context, packing, uploads, index + 1);
};

/** The submitted revision's answers and their rendered document. */
const renderDocument = async ({ job, services, signal }: Context) => {
  const answers = await services.answers.readRevision(job.revisionId);
  signal.throwIfAborted();
  if (!answers) throw new JobFailedError(NO_ANSWERS);
  const document = await services.documents.render({ revisionId: job.revisionId, answers });
  signal.throwIfAborted();
  if (document.status !== 'ok') throw RENDER_STOPS[document.status]();
  return { answers, document };
};

/**
 * Writes the package to `zipFile`: the document, named after its template, each upload under
 * attachments/, and missing-files.txt when an upload was left out.
 */
const writePackage = async (
  context: Context,
  settings: PackageSettings,
  zipFile: TempResource,
  staged: TempResource[],
): Promise<void> => {
  const { answers, document } = await renderDocument(context);
  const limitBytes = Math.min(settings.maxPackageMb * MB, context.result.maxBytes);
  if (document.data.length > limitBytes) throw new JobFailedError(packageTooLarge(limitBytes));
  const uploads = uploadsIn(answers);
  const packing: Packing = {
    zip: openZip(zipFile.path, context.signal),
    limitBytes,
    maxFileBytes: settings.maxFileMb * MB,
    bytes: document.data.length,
    leftOut: [],
    staged,
    attached: 0,
  };
  const { confirmationCode } = context.submission;
  let size: number | undefined;
  try {
    packing.zip.addBuffer(
      document.data,
      reportName(document.templateName, confirmationCode, document.contentType),
    );
    context.reportProgress(1, uploads.length + 1);
    await addUploads(context, packing, uploads);
    if (packing.leftOut.length > 0) {
      const text = missingFilesText(packing.leftOut, settings.maxFileMb);
      packing.zip.addBuffer(Buffer.from(text), 'missing-files.txt');
    }
    size = await writing(context, () => packing.zip.finish());
  } finally {
    // Closes the file, so its space is freed once it is removed.
    if (size === undefined) await packing.zip.abandon();
  }
  // Zip headers add to the entries, so the file on disk is checked as well.
  if (size > limitBytes) throw new JobFailedError(packageTooLarge(limitBytes));
  context.log.info(
    { uploads: uploads.length, leftOut: packing.leftOut.length, size },
    'Package built',
  );
};

/** Stores the package; failures other than the store's own outcomes throw a fixed message. */
const store = async (context: Context, zipFile: TempResource, name: string) => {
  try {
    await context.result.store(zipFile, {
      filename: `${name}.zip`,
      contentType: 'application/zip',
    });
  } catch (err) {
    const outcome = err instanceof JobFailedError || err instanceof JobCancelledError;
    if (context.signal.aborted || outcome) throw err;
    failWith(context, err, PACKAGE_NOT_STORED, 'Package not stored');
  }
};

/**
 * The build step: waits while no email could be sent, renders the submitted revision, and stores
 * `<form name>-<confirmation code>.zip` as the job's result.
 */
export const buildPackage =
  (settings: PackageSettings) =>
  async (context: Context): Promise<void> => {
    const { services, signal, submission } = context;
    await services.notifications.ready();
    signal.throwIfAborted();
    const name = packageName(submission.formName, submission.confirmationCode);
    const zipFile = reserve(context, 'package');
    const staged: TempResource[] = [];
    try {
      await writePackage(context, settings, zipFile, staged);
      await store(context, zipFile, name);
    } finally {
      await Promise.all(
        [zipFile, ...staged].map((resource) => services.tempStorage.remove(resource)),
      );
    }
  };
