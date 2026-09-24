jest.mock('../../../src/core/db/repos/formSubmitAccessRepo', () => ({
  hasFormSubmitAccess: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/submissionParticipantRepo', () => ({
  isActiveParticipant: jest.fn(),
}));

import { hasFormSubmitAccess } from '../../../src/core/db/repos/formSubmitAccessRepo';
import { isActiveParticipant } from '../../../src/core/db/repos/submissionParticipantRepo';
import {
  isSubmitterAllowed,
  SubmitterOperation,
  type SubmitterOperationCode,
} from '../../../src/core/services/submitterAccess';
import { Permissions, type PermissionCode } from '../../../src/core/db/codes';

const mockParticipant = jest.mocked(isActiveParticipant);
const mockFormPermission = jest.mocked(hasFormSubmitAccess);

const caller = { actorId: 'u1', idpCode: 'idir' };
const target = { workspaceId: 'ws1', formId: 'f1', submissionId: 's1' };

/** Grants the caller participation and the listed form permissions, and nothing else. */
const grant = (participant: boolean, permissions: PermissionCode[]) => {
  mockParticipant.mockResolvedValue(participant);
  mockFormPermission.mockImplementation(async (_t, _c, required) => permissions.includes(required));
};

beforeEach(() => {
  mockParticipant.mockReset();
  mockFormPermission.mockReset();
});

const { open, read, write, deleteSubmittedFile } = SubmitterOperation;
const create = Permissions.submission_create;
const update = Permissions.submission_update;

// [operation, participant, form permissions held, allowed]
const matrix: [SubmitterOperationCode, boolean, PermissionCode[], boolean][] = [
  [open, false, [create], true],
  [open, true, [], false],
  [read, true, [], true],
  [read, false, [create, Permissions.submission_read], false],
  [write, true, [create], true],
  [write, true, [], false],
  [write, false, [create], false],
  [deleteSubmittedFile, false, [update], true],
  [deleteSubmittedFile, true, [create], false],
];

it.each(matrix)(
  '%s with participant=%s and %j is allowed=%s',
  async (op, participant, perms, ok) => {
    grant(participant, perms);
    await expect(isSubmitterAllowed(op, target, caller)).resolves.toBe(ok);
  },
);

it('never consults the form audience for a read', async () => {
  grant(true, []);
  await isSubmitterAllowed(read, target, caller);
  expect(mockFormPermission).not.toHaveBeenCalled();
  expect(mockParticipant).toHaveBeenCalledWith('s1', 'u1');
});

it('checks participation before the form permission on a write, and stops at a refusal', async () => {
  grant(false, [create]);
  await isSubmitterAllowed(write, target, caller);
  expect(mockFormPermission).not.toHaveBeenCalled();
});

it('never consults participation to open', async () => {
  grant(false, [create]);
  await isSubmitterAllowed(open, { workspaceId: 'ws1', formId: 'f1' }, caller);
  expect(mockParticipant).not.toHaveBeenCalled();
});

it('refuses a read without an actor or a submission, without a lookup', async () => {
  grant(true, []);
  await expect(isSubmitterAllowed(read, target, { actorId: null })).resolves.toBe(false);
  await expect(
    isSubmitterAllowed(read, { workspaceId: 'ws1', formId: 'f1' }, caller),
  ).resolves.toBe(false);
  expect(mockParticipant).not.toHaveBeenCalled();
});
