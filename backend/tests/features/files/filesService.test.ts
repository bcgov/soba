/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import os from 'os';
import path from 'path';

// In-memory file and submission_file rows so the service can be exercised without a database.
const mockFiles = new Map<string, any>();
const mockLinks = new Map<string, string>();
const mockTx = {};

jest.mock('../../../src/core/db/repos/fileRepo', () => {
  let seq = 0;
  return {
    createFileRecord: jest.fn(async (input: any, link: any) => {
      const record = {
        id: `file-${++seq}`,
        workspaceId: input.workspaceId,
        profile: input.profile,
        backendRef: input.backendRef,
        filename: input.filename,
        contentType: input.contentType ?? null,
        size: input.size ?? null,
        createdBy: input.createdBy ?? null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await link(mockTx, record);
      mockFiles.set(record.id, record);
      return record;
    }),
    deleteFileRecord: jest.fn(async (record: any, unlink: any) => {
      await unlink(mockTx, record);
      mockFiles.delete(record.id);
    }),
  };
});
jest.mock('../../../src/core/db/repos/submissionFileRepo', () => ({
  linkFileToSubmission: jest.fn(async (_tx: unknown, link: any) => {
    mockLinks.set(link.fileId, link.submissionId);
  }),
  unlinkSubmissionFile: jest.fn(async (_tx: unknown, fileId: string) => {
    mockLinks.delete(fileId);
  }),
  getSubmissionFileByFileId: jest.fn(async (fileId: string) => {
    const file = mockFiles.get(fileId);
    const submissionId = mockLinks.get(fileId);
    return file && submissionId ? { file, submissionId } : null;
  }),
}));

// Authorization lookups are mocked; the storage + service logic is exercised for real.
jest.mock('../../../src/core/db/repos/formSubmitAccessRepo', () => ({
  hasFormSubmitAccess: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/submissionRepo', () => ({
  getSubmissionRecordById: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/submissionParticipantRepo', () => ({
  isActiveParticipant: jest.fn(),
}));
// Antivirus off here: these cases predate scanning and cover storage + authorization.
jest.mock('../../../src/core/db/repos/featureRepo', () => ({
  isFeatureEnabledCached: jest.fn().mockResolvedValue(false),
}));

import { filesService } from '../../../src/features/files/service';
import { createFileRecord, deleteFileRecord } from '../../../src/core/db/repos/fileRepo';
import { linkFileToSubmission } from '../../../src/core/db/repos/submissionFileRepo';
import { hasFormSubmitAccess } from '../../../src/core/db/repos/formSubmitAccessRepo';
import { getSubmissionRecordById } from '../../../src/core/db/repos/submissionRepo';
import { isActiveParticipant } from '../../../src/core/db/repos/submissionParticipantRepo';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'files-svc-'));
process.env.STORAGE_PROFILES = 'default';
process.env.FILES_STORAGE_PROFILE = 'default';
process.env.STORAGE_PROFILE_DEFAULT_BACKEND = 'storage-local';
process.env.STORAGE_PROFILE_DEFAULT_BASE_PATH = tmp;

const audienceMock = hasFormSubmitAccess as jest.Mock;
const submissionMock = getSubmissionRecordById as jest.Mock;
const participantMock = isActiveParticipant as jest.Mock;

/** Grants the caller exactly the listed form permissions. */
const holding = (held: string[]) =>
  audienceMock.mockImplementation(async (_t: unknown, _c: unknown, p: string) => held.includes(p));

const owner = { actorId: 'actor1', idpCode: 'idir' };
const intruder = { actorId: 'intruder', idpCode: 'idir' };

// upload() returns a discriminated union once antivirus can reject; with the feature off here it is
// always a record. Narrow so the download/delete cases can read the id.
async function uploadRecord(params: Parameters<typeof filesService.upload>[0]) {
  const result = await filesService.upload(params);
  if (typeof result === 'string') throw new Error(`unexpected scan outcome: ${result}`);
  return result;
}

const uploadFor = (submissionId: string, filename = 'a.txt') =>
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
  beforeEach(() => {
    audienceMock.mockReset();
    submissionMock.mockReset();
    participantMock.mockReset();
    participantMock.mockImplementation(
      async (_submissionId: string, userId: string) => userId === owner.actorId,
    );
  });

  it('a participant downloads, and deletes an un-submitted attachment', async () => {
    const record = await uploadFor('sub1');
    expect(record.id).toBeTruthy();

    audienceMock.mockResolvedValue(true);
    submissionMock.mockResolvedValue({ id: 'sub1', workflowState: 'draft', formId: 'form1' });
    const got = await filesService.getForCaller(record.id, owner);
    if (got === 'notfound' || got === 'denied' || !got.file.downloadStream) {
      throw new Error('expected a file with a download stream');
    }
    expect(got.record.filename).toBe('a.txt');
    expect(await readAll(got.file.downloadStream)).toBe('abc');
    // The link's submission is read within the file's own workspace.
    expect(submissionMock).toHaveBeenCalledWith('ws1', 'sub1');

    // Un-submitted: a participant who is still in the submit audience may delete.
    expect(await filesService.deleteForCaller(record.id, owner)).toBe('deleted');
    expect(mockLinks.has(record.id)).toBe(false);

    expect(participantMock).toHaveBeenCalledWith('sub1', owner.actorId);
    // The audience is checked against the submission's form, whose audience may override the
    // workspace's. Download needs no audience check.
    expect(audienceMock).toHaveBeenCalledTimes(1);
    expect(audienceMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws1', formId: 'form1' }),
      owner,
      'submission_create',
    );
  });

  it('denies download to a caller who is not a participant, even one in the audience', async () => {
    const record = await uploadFor('sub1', 'b.txt');
    submissionMock.mockResolvedValue({ id: 'sub1', workflowState: 'draft', formId: 'form1' });
    audienceMock.mockResolvedValue(true);
    expect(await filesService.getForCaller(record.id, intruder)).toBe('denied');
  });

  it('returns notfound when the owning submission no longer exists (download)', async () => {
    const record = await uploadFor('sub1', 'h.txt');
    submissionMock.mockResolvedValue(null); // submission soft-deleted / gone
    audienceMock.mockResolvedValue(true);
    expect(await filesService.getForCaller(record.id, owner)).toBe('notfound');
  });

  it('treats a file with no submission link as notfound (submission-scoped)', async () => {
    const record = await uploadFor('sub1', 'c.txt');
    mockLinks.delete(record.id);
    audienceMock.mockResolvedValue(true);
    expect(await filesService.getForCaller(record.id, owner)).toBe('notfound');
  });

  it('lets only a participant delete an un-submitted attachment', async () => {
    const record = await uploadFor('sub1', 'd.txt');
    submissionMock.mockResolvedValue({ id: 'sub1', workflowState: 'draft', formId: 'form1' });
    audienceMock.mockResolvedValue(true);
    expect(await filesService.deleteForCaller(record.id, intruder)).toBe('denied');
  });

  it("refuses a delete on a submitted submission's file to a participant holding only submission_create", async () => {
    const record = await uploadFor('sub1', 'e.txt');
    submissionMock.mockResolvedValue({ id: 'sub1', workflowState: 'submitted', formId: 'form1' });
    holding(['submission_create']);
    expect(await filesService.deleteForCaller(record.id, owner)).toBe('denied');
  });

  it("lets a non-participant with submission_update delete a submitted submission's file", async () => {
    const record = await uploadFor('sub1', 'e2.txt');
    submissionMock.mockResolvedValue({ id: 'sub1', workflowState: 'submitted', formId: 'form1' });
    holding(['submission_update']);
    expect(await filesService.deleteForCaller(record.id, intruder)).toBe('deleted');
    expect(audienceMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws1', formId: 'form1' }),
      intruder,
      'submission_update',
    );
  });

  it('a participant no longer in the submit audience cannot delete', async () => {
    const record = await uploadFor('sub1', 'f.txt');
    submissionMock.mockResolvedValue({ id: 'sub1', workflowState: 'draft', formId: 'form1' });
    audienceMock.mockResolvedValue(false);
    expect(await filesService.deleteForCaller(record.id, owner)).toBe('denied');
  });

  it('delete of a file with no submission link is notfound', async () => {
    const record = await uploadFor('sub1', 'g.txt');
    mockLinks.delete(record.id);
    expect(await filesService.deleteForCaller(record.id, owner)).toBe('notfound');
  });

  it('removes the stored blob when the file-record insert fails (no orphan)', async () => {
    const before = listBlobs(tmp);
    (createFileRecord as jest.Mock).mockRejectedValueOnce(new Error('insert failed'));
    await expect(uploadFor('sub1', 'orphan.txt')).rejects.toThrow('insert failed');
    expect(listBlobs(tmp)).toEqual(before);
  });

  it('removes the stored blob when the submission link insert fails (no orphan)', async () => {
    const before = listBlobs(tmp);
    (linkFileToSubmission as jest.Mock).mockRejectedValueOnce(new Error('link failed'));
    await expect(uploadFor('sub1', 'unlinked.txt')).rejects.toThrow('link failed');
    expect(listBlobs(tmp)).toEqual(before);
  });

  it('leaves the blob intact when the row delete fails (row-first ordering)', async () => {
    const record = await uploadFor('sub1', 'keep.txt');
    submissionMock.mockResolvedValue({ id: 'sub1', workflowState: 'draft', formId: 'form1' });
    audienceMock.mockResolvedValue(true);
    const blobs = listBlobs(tmp);
    (deleteFileRecord as jest.Mock).mockRejectedValueOnce(new Error('row delete failed'));
    await expect(filesService.deleteForCaller(record.id, owner)).rejects.toThrow(
      'row delete failed',
    );
    // Row-first: the throw precedes deleteFile, so the blob is still present (retryable, no orphan).
    expect(listBlobs(tmp)).toEqual(blobs);
  });
});
