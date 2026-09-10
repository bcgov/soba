import type { NextFunction, Request, Response } from 'express';

jest.mock('../../../src/core/db/repos/fileRepo', () => ({
  getFileRecordById: jest.fn(),
  getFormFileRecordById: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/submissionRepo', () => ({
  getSubmissionRecordById: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/formSubmitAccessRepo', () => ({
  hasFormSubmitAccess: jest.fn(),
}));

import { getFileRecordById, getFormFileRecordById } from '../../../src/core/db/repos/fileRepo';
import { getSubmissionRecordById } from '../../../src/core/db/repos/submissionRepo';
import { hasFormSubmitAccess } from '../../../src/core/db/repos/formSubmitAccessRepo';
import { Permissions, SubmissionWorkflowState } from '../../../src/core/db/codes';
import {
  requireFormFile,
  requireSubmissionFileDeleteAccess,
  requireSubmissionFileReadAccess,
} from '../../../src/features/files/fileAccess';

const fileRecord = {
  id: 'file-id',
  workspaceId: 'workspace-id',
  formId: 'form-id',
  submissionId: 'submission-id',
};
const response = {} as Response;
const fileByIdMock = getFileRecordById as jest.Mock;
const formFileMock = getFormFileRecordById as jest.Mock;
const submissionMock = getSubmissionRecordById as jest.Mock;
const accessMock = hasFormSubmitAccess as jest.Mock;

function nextMock(): NextFunction {
  return jest.fn() as unknown as NextFunction;
}

describe('file access middleware', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('resolves a form-owned file after form permission middleware has run', async () => {
    formFileMock.mockResolvedValue(fileRecord);
    const request = {
      params: { id: 'form-id', fileId: 'file-id' },
      coreContext: { workspaceId: 'workspace-id' },
    } as unknown as Request;
    const next = nextMock();

    await requireFormFile(request, response, next);

    expect(formFileMock).toHaveBeenCalledWith('file-id', 'form-id', 'workspace-id');
    expect(request.fileRecord).toBe(fileRecord);
    expect(request.fileDownloadDisposition).toBe('attachment');
    expect(next).toHaveBeenCalledWith();
  });

  it('allows submission reads only for callers with submission_read', async () => {
    fileByIdMock.mockResolvedValue(fileRecord);
    submissionMock.mockResolvedValue({ workflowState: SubmissionWorkflowState.draft });
    accessMock.mockResolvedValue(true);
    const request = {
      params: { id: 'file-id' },
      actorId: 'actor-id',
      idpType: 'idir',
    } as unknown as Request;
    const next = nextMock();

    await requireSubmissionFileReadAccess(request, response, next);

    expect(accessMock).toHaveBeenCalledWith(
      'workspace-id',
      { actorId: 'actor-id', idpCode: 'idir' },
      Permissions.submission_read,
    );
    expect(request.fileRecord).toBe(fileRecord);
    expect(request.fileDownloadDisposition).toBe('inline');
    expect(next).toHaveBeenCalledWith();
  });

  it('denies deletion of a draft file when the caller is not its owner', async () => {
    fileByIdMock.mockResolvedValue(fileRecord);
    submissionMock.mockResolvedValue({
      workflowState: SubmissionWorkflowState.draft,
      submittedBy: 'another-actor',
    });
    const request = {
      params: { id: 'file-id' },
      actorId: 'actor-id',
      idpType: 'idir',
    } as unknown as Request;
    const next = nextMock();

    await requireSubmissionFileDeleteAccess(request, response, next);

    expect(accessMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Not authorized to access this file' }),
    );
    expect(request.fileRecord).toBeUndefined();
  });

  it('uses submission_update for deleting a submitted file', async () => {
    fileByIdMock.mockResolvedValue(fileRecord);
    submissionMock.mockResolvedValue({
      workflowState: SubmissionWorkflowState.submitted,
      submittedBy: 'another-actor',
    });
    accessMock.mockResolvedValue(true);
    const request = {
      params: { id: 'file-id' },
      actorId: 'actor-id',
      idpType: 'idir',
    } as unknown as Request;
    const next = nextMock();

    await requireSubmissionFileDeleteAccess(request, response, next);

    expect(accessMock).toHaveBeenCalledWith(
      'workspace-id',
      { actorId: 'actor-id', idpCode: 'idir' },
      Permissions.submission_update,
    );
    expect(request.fileRecord).toBe(fileRecord);
    expect(next).toHaveBeenCalledWith();
  });
});
