import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { openZip } from '../../../src/plugins/post-submission-email-package/zip';
import { openFilesUnder } from './openFiles';
import { readZip } from './readZip';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'package-zip-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('openZip', () => {
  it('writes buffers and streams, stored without compression, and reports its size', async () => {
    const path = join(dir, 'good.zip');
    const zip = openZip(path, new AbortController().signal);

    zip.addBuffer(Buffer.from('the document'), 'Form ABC123.pdf');
    await zip.addStream(
      Readable.from([Buffer.from('first '), Buffer.from('upload')]),
      'files/a.txt',
      12,
    );
    await zip.addStream(Readable.from([Buffer.from('second')]), 'files/b.txt', 6);
    const size = await zip.finish();

    expect(size).toBe((await stat(path)).size);
    expect(await readZip(path)).toEqual([
      { name: 'Form ABC123.pdf', method: 0, data: Buffer.from('the document') },
      { name: 'files/a.txt', method: 0, data: Buffer.from('first upload') },
      { name: 'files/b.txt', method: 0, data: Buffer.from('second') },
    ]);
  });

  it('fails when a stream holds fewer bytes than its size', async () => {
    const zip = openZip(join(dir, 'short.zip'), new AbortController().signal);

    const added = zip.addStream(Readable.from([Buffer.from('short')]), 'files/a.txt', 50);

    await expect(added.then(() => zip.finish())).rejects.toThrow();
  });

  it('fails when a stream errors part way', async () => {
    const zip = openZip(join(dir, 'broken.zip'), new AbortController().signal);
    const broken = new Readable({
      read() {
        this.push(Buffer.from('part'));
        this.destroy(new Error('storage went away'));
      },
    });

    await expect(zip.addStream(broken, 'files/a.txt', 100)).rejects.toThrow('storage went away');
  });

  it('closes its file when abandoned part way, whatever stopped it', async () => {
    const path = join(dir, 'abandoned.zip');
    const zip = openZip(path, new AbortController().signal);
    zip.addBuffer(Buffer.from('the document'), 'Form ABC123.pdf');
    await expect(
      zip.addStream(Readable.from([Buffer.from('short')]), 'files/a.txt', 50),
    ).rejects.toThrow();

    await zip.abandon();
    await rm(path, { force: true });

    expect(await openFilesUnder(path)).toEqual([]);
  });

  it('closes its file when abandoned before any entry was written', async () => {
    const path = join(dir, 'empty.zip');
    const zip = openZip(path, new AbortController().signal);

    await zip.abandon();

    expect(await openFilesUnder(path)).toEqual([]);
  });

  it('fails once the signal aborts', async () => {
    const controller = new AbortController();
    const zip = openZip(join(dir, 'aborted.zip'), controller.signal);
    zip.addBuffer(Buffer.from('the document'), 'Form ABC123.pdf');

    controller.abort();

    await expect(zip.finish()).rejects.toThrow();
  });
});
