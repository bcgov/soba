/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import os from 'os';
import path from 'path';

// In-memory fileRepo so the service can be exercised without a database.
jest.mock('../../../src/core/db/repos/fileRepo', () => {
  const store = new Map<string, any>();
  let seq = 0;
  return {
    createFileRecord: jest.fn(async (input: any) => {
      const id = `file-${++seq}`;
      const record = {
        id,
        workspaceId: input.workspaceId,
        profile: input.profile,
        backendRef: input.backendRef,
        filename: input.filename,
        contentType: input.contentType ?? null,
        size: input.size ?? null,
        formId: input.formId ?? null,
        submissionId: input.submissionId ?? null,
        createdBy: input.createdBy ?? null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(id, record);
      return record;
    }),
    getFileRecordById: jest.fn(async (id: string) => store.get(id) ?? null),
    getFormFileRecordById: jest.fn(async (id: string, formId: string, workspaceId: string) => {
      const record = store.get(id);
      return record?.formId === formId && record?.workspaceId === workspaceId ? record : null;
    }),
    deleteFileRecordById: jest.fn(async (id: string) => {
      store.delete(id);
    }),
    associateFilesWithSubmission: jest.fn(
      async (fileIds: string[], submissionId: string, workspaceId: string) => {
        let count = 0;
        for (const id of fileIds) {
          const rec = store.get(id);
          if (
            rec &&
            rec.workspaceId === workspaceId &&
            (rec.submissionId == null || rec.submissionId === submissionId)
          ) {
            rec.submissionId = submissionId;
            count += 1;
          }
        }
        return count;
      },
    ),
  };
});

// Antivirus off here: these cases predate scanning and cover storage + authorization.
jest.mock('../../../src/core/db/repos/featureRepo', () => ({
  isFeatureEnabledCached: jest.fn().mockResolvedValue(false),
}));

import { filesService } from '../../../src/features/files/service';
import { createFileRecord, deleteFileRecordById } from '../../../src/core/db/repos/fileRepo';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'files-svc-'));
process.env.STORAGE_PROFILES = 'default';
process.env.FILES_STORAGE_PROFILE = 'default';
process.env.STORAGE_PROFILE_DEFAULT_BACKEND = 'storage-local';
process.env.STORAGE_PROFILE_DEFAULT_BASE_PATH = tmp;

// upload() returns a discriminated union once antivirus can reject; with the feature off here it is
// always a record. Narrow so the download/delete cases can read the id.
async function uploadRecord(params: Parameters<typeof filesService.upload>[0]) {
  const result = await filesService.upload(params);
  if (typeof result === 'string') throw new Error(`unexpected scan outcome: ${result}`);
  return result;
}

const uploadFor = (submissionId: string | null, filename = 'a.txt') =>
  uploadRecord({
    workspaceId: 'ws1',
    actorId: 'actor1',
    filename,
    contentType: 'text/plain',
    size: 3,
    buffer: Buffer.from('abc'),
    submissionId,
  });

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

/** Every stored blob under the temp backend, so a test can assert nothing was orphaned/left behind. */
function listBlobs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listBlobs(full));
    else out.push(full);
  }
  return out.sort();
}

describe('filesService', () => {
  it('gets and deletes a stored attachment', async () => {
    const record = await uploadFor('sub1');
    expect(record.id).toBeTruthy();

    const file = await filesService.get(record);
    if (file === 'notfound' || !file.downloadStream) {
      throw new Error('expected a file with a download stream');
    }
    expect(await readAll(file.downloadStream)).toBe('abc');

    await expect(filesService.delete(record)).resolves.toBeUndefined();
  });

  it('associates only same-workspace files referenced in submission data', async () => {
    const f1 = await uploadRecord({
      workspaceId: 'ws1',
      actorId: 'a',
      filename: 'f1.pdf',
      buffer: Buffer.from('1'),
    });
    const f2 = await uploadRecord({
      workspaceId: 'ws1',
      actorId: 'a',
      filename: 'f2.pdf',
      buffer: Buffer.from('2'),
    });
    const other = await uploadRecord({
      workspaceId: 'ws2',
      actorId: 'a',
      filename: 'x.pdf',
      buffer: Buffer.from('3'),
    });

    const data = {
      files: [
        { storage: 'chefs', id: f1.id },
        { storage: 'chefs', id: f2.id },
        { storage: 'chefs', id: other.id }, // different workspace — must not be claimed
        { storage: 'url', id: 'ignored' },
      ],
    };
    // ws1 files get tagged; the ws2 file is left alone (tenancy boundary).
    expect(await filesService.associateWithSubmission('sub1', 'ws1', data)).toBe(2);
  });

  it('gets and deletes a file only within its owning form and workspace', async () => {
    const record = await uploadRecord({
      workspaceId: 'ws1',
      actorId: 'actor1',
      filename: 'template.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('template'),
      formId: 'form1',
      useProfile: 'default',
    });

    const file = await filesService.get(record);
    if (file === 'notfound' || !file.downloadStream) {
      throw new Error('expected a form file with a download stream');
    }
    expect(await readAll(file.downloadStream)).toBe('template');
    await expect(filesService.delete(record)).resolves.toBeUndefined();
  });

  it('removes the stored blob when the file-record insert fails (no orphan)', async () => {
    const before = listBlobs(tmp);
    (createFileRecord as jest.Mock).mockRejectedValueOnce(new Error('insert failed'));
    await expect(
      filesService.upload({
        workspaceId: 'ws1',
        actorId: 'actor1',
        filename: 'orphan.txt',
        buffer: Buffer.from('zz'),
        submissionId: 'sub1',
      }),
    ).rejects.toThrow('insert failed');
    expect(listBlobs(tmp)).toEqual(before);
  });

  it('leaves the blob intact when the row delete fails (row-first ordering)', async () => {
    const record = await uploadFor('sub1', 'keep.txt');
    const blobs = listBlobs(tmp);
    (deleteFileRecordById as jest.Mock).mockRejectedValueOnce(new Error('row delete failed'));
    await expect(filesService.delete(record)).rejects.toThrow('row delete failed');
    // Row-first: the throw precedes deleteFile, so the blob is still present (retryable, no orphan).
    expect(listBlobs(tmp)).toEqual(blobs);
  });
});
