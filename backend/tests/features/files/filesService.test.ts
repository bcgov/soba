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

jest.mock('../../../src/core/db/repos/membershipRepo', () => ({
  actorBelongsToWorkspace: jest.fn(),
}));

import { filesService } from '../../../src/features/files/service';
import { actorBelongsToWorkspace } from '../../../src/core/db/repos/membershipRepo';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'files-svc-'));
process.env.STORAGE_PROFILES = 'default';
process.env.FILES_STORAGE_PROFILE = 'default';
process.env.STORAGE_PROFILE_DEFAULT_BACKEND = 'local-storage';
process.env.STORAGE_PROFILE_DEFAULT_BASE_PATH = tmp;

const membershipMock = actorBelongsToWorkspace as jest.Mock;

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

describe('filesService', () => {
  beforeEach(() => membershipMock.mockReset());

  it('uploads, then a workspace member can download and delete', async () => {
    membershipMock.mockResolvedValue(true);

    const record = await filesService.upload({
      workspaceId: 'ws1',
      actorId: 'actor1',
      filename: 'a.txt',
      contentType: 'text/plain',
      size: 3,
      buffer: Buffer.from('abc'),
    });
    expect(record.id).toBeTruthy();
    expect(record.backendRef).toBeTruthy();

    const got = await filesService.getForActor(record.id, 'actor1');
    if (!got || !got.file.downloadStream) throw new Error('expected file with a download stream');
    expect(got.record.filename).toBe('a.txt');
    // Consume the stream (as the controller would pipe it) and verify content.
    expect(await readAll(got.file.downloadStream)).toBe('abc');

    expect(await filesService.deleteForActor(record.id, 'actor1')).toBe('deleted');
    // After delete the record is gone.
    membershipMock.mockResolvedValue(true);
    expect(await filesService.getForActor(record.id, 'actor1')).toBeNull();
  });

  it('associates only same-workspace files referenced in submission data', async () => {
    membershipMock.mockResolvedValue(true);
    const f1 = await filesService.upload({
      workspaceId: 'ws1',
      actorId: 'a',
      filename: 'f1.pdf',
      buffer: Buffer.from('1'),
    });
    const f2 = await filesService.upload({
      workspaceId: 'ws1',
      actorId: 'a',
      filename: 'f2.pdf',
      buffer: Buffer.from('2'),
    });
    const other = await filesService.upload({
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

  it('denies download and delete to a non-member', async () => {
    membershipMock.mockResolvedValue(true);
    const record = await filesService.upload({
      workspaceId: 'ws1',
      actorId: 'actor1',
      filename: 'b.txt',
      buffer: Buffer.from('xyz'),
    });

    membershipMock.mockResolvedValue(false);
    expect(await filesService.getForActor(record.id, 'intruder')).toBeNull();
    expect(await filesService.deleteForActor(record.id, 'intruder')).toBe('notfound');
  });
});
