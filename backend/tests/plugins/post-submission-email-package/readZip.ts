import { open, type Entry, type ZipFile } from 'yauzl';

/** One entry of a zip as read back: its name, compression method (0 is stored) and bytes. */
export interface ZipEntryRead {
  name: string;
  method: number;
  data: Buffer;
}

const openFile = (path: string): Promise<ZipFile> =>
  new Promise((resolve, reject) => {
    open(path, { lazyEntries: true }, (error, zip) =>
      error || !zip ? reject(error ?? new Error('No zip')) : resolve(zip),
    );
  });

const bytesOf = (zip: ZipFile, entry: Entry): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error('No entry stream'));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });

/** Every entry of the zip at `path`, in order. */
export const readZip = async (path: string): Promise<ZipEntryRead[]> => {
  const zip = await openFile(path);
  const entries: ZipEntryRead[] = [];
  const add = async (entry: Entry) => {
    const data = await bytesOf(zip, entry);
    entries.push({ name: entry.fileName, method: entry.compressionMethod, data });
    zip.readEntry();
  };
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('end', () => resolve());
    zip.on('entry', (entry: Entry) => {
      add(entry).catch(reject);
    });
    zip.readEntry();
  });
  return entries;
};
