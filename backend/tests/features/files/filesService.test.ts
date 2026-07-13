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

// Authorization lookups are mocked; the storage + service logic is exercised for real.
jest.mock('../../../src/core/db/repos/formSubmitAccessRepo', () => ({
  hasFormSubmitAccess: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/submissionRepo', () => ({
  getSubmissionRecordById: jest.fn(),
}));

import { filesService } from '../../../src/features/files/service';
import { hasFormSubmitAccess } from '../../../src/core/db/repos/formSubmitAccessRepo';
import { getSubmissionRecordById } from '../../../src/core/db/repos/submissionRepo';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'files-svc-'));
process.env.STORAGE_PROFILES = 'default';
process.env.FILES_STORAGE_PROFILE = 'default';
process.env.STORAGE_PROFILE_DEFAULT_BACKEND = 'storage-local';
process.env.STORAGE_PROFILE_DEFAULT_BASE_PATH = tmp;

const audienceMock = hasFormSubmitAccess as jest.Mock;
const submissionMock = getSubmissionRecordById as jest.Mock;

const owner = { actorId: 'actor1', idpCode: 'idir' };
const intruder = { actorId: 'intruder', idpCode: 'idir' };

const uploadFor = (submissionId: string | null, filename = 'a.txt') =>
  filesService.upload({
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

describe('filesService', () => {
  beforeEach(() => {
    audienceMock.mockReset();
    submissionMock.mockReset();
  });

  it('an audience member downloads, and the owner deletes an un-submitted attachment', async () => {
    const record = await uploadFor('sub1');
    expect(record.id).toBeTruthy();

    audienceMock.mockResolvedValue(true); // submission_read + submission_create granted
    submissionMock.mockResolvedValue({ workflowState: 'draft', submittedBy: 'actor1' });
    const got = await filesService.getForCaller(record.id, owner);
    if (got === 'notfound' || got === 'denied' || !got.file.downloadStream) {
      throw new Error('expected a file with a download stream');
    }
    expect(got.record.filename).toBe('a.txt');
    expect(await readAll(got.file.downloadStream)).toBe('abc');

    // Un-submitted: the submission's owner (submittedBy) may delete.
    expect(await filesService.deleteForCaller(record.id, owner)).toBe('deleted');
  });

  it('associates only same-workspace files referenced in submission data', async () => {
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

  it('denies download to a caller not in the submitters audience', async () => {
    const record = await uploadFor('sub1', 'b.txt');
    submissionMock.mockResolvedValue({ workflowState: 'draft', submittedBy: 'actor1' });
    audienceMock.mockResolvedValue(false);
    expect(await filesService.getForCaller(record.id, intruder)).toBe('denied');
  });

  it('returns notfound when the owning submission no longer exists (download)', async () => {
    const record = await uploadFor('sub1', 'h.txt');
    submissionMock.mockResolvedValue(null); // submission soft-deleted / gone
    audienceMock.mockResolvedValue(true);
    expect(await filesService.getForCaller(record.id, owner)).toBe('notfound');
  });

  it('treats a file with no owning submission as notfound (submission-scoped)', async () => {
    const record = await uploadFor(null, 'c.txt');
    audienceMock.mockResolvedValue(true);
    expect(await filesService.getForCaller(record.id, owner)).toBe('notfound');
  });

  it('lets only the owner delete an un-submitted attachment', async () => {
    const record = await uploadFor('sub1', 'd.txt');
    submissionMock.mockResolvedValue({ workflowState: 'draft', submittedBy: 'actor1' });
    expect(await filesService.deleteForCaller(record.id, intruder)).toBe('denied');
  });

  it("a submitted submission's file: only staff with submission_update may delete", async () => {
    const record = await uploadFor('sub1', 'e.txt');
    submissionMock.mockResolvedValue({ workflowState: 'submitted', submittedBy: 'actor1' });

    audienceMock.mockResolvedValue(false); // no submission_update
    expect(await filesService.deleteForCaller(record.id, owner)).toBe('denied');

    audienceMock.mockResolvedValue(true); // staff holds submission_update
    expect(await filesService.deleteForCaller(record.id, owner)).toBe('deleted');
  });

  it('an owner not in the submit audience cannot delete (bounds anonymous cross-workspace)', async () => {
    const record = await uploadFor('sub1', 'f.txt');
    submissionMock.mockResolvedValue({ workflowState: 'draft', submittedBy: 'actor1' });
    audienceMock.mockResolvedValue(false); // id matches submittedBy, but not in the workspace audience
    expect(await filesService.deleteForCaller(record.id, owner)).toBe('denied');
  });

  it('delete of a file with no owning submission is notfound', async () => {
    const record = await uploadFor(null, 'g.txt');
    expect(await filesService.deleteForCaller(record.id, owner)).toBe('notfound');
  });
});
