jest.mock('../../../../src/features/form-settings/submitter/drafts', () => ({
  ...jest.requireActual('../../../../src/features/form-settings/submitter/drafts'),
  getDraftSaveStatus: jest.fn(),
}));

import type { NextFunction, Request, Response } from 'express';
import { requireDraftSave } from '../../../../src/core/api/submit/draftSave';
import { getDraftSaveStatus } from '../../../../src/features/form-settings/submitter/drafts';
import { ForbiddenError } from '../../../../src/core/errors';
import { log } from '../../../../src/core/logging';

const res = {} as Response;
const mockStatus = jest.mocked(getDraftSaveStatus);

function makeReq(opts: { formId?: string; authed?: boolean }): Request {
  return {
    coreContext: opts.formId ? { workspaceId: 'ws1', formId: opts.formId } : undefined,
    params: { id: 's1' },
    user: opts.authed ? ({ providerCode: 'azureidir' } as Express.User) : undefined,
    actorId: 'actor1',
  } as unknown as Request;
}

async function run(req: Request): Promise<unknown> {
  const next = jest.fn() as unknown as NextFunction;
  await requireDraftSave(req, res, next);
  return (next as jest.Mock).mock.calls[0][0];
}

describe('requireDraftSave', () => {
  beforeEach(() => mockStatus.mockReset());

  it('passes a save on a form that accepts drafts', async () => {
    mockStatus.mockResolvedValue('allowed');
    expect(await run(makeReq({ formId: 'f1', authed: true }))).toBeUndefined();
    expect(mockStatus).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws1' }), 'f1');
  });

  it.each([
    ['disabled', 'Drafts are not enabled for this form'],
    ['public', 'Drafts are not available on a public form'],
  ] as const)('refuses a %s form with 403 and logs the reason', async (status, message) => {
    mockStatus.mockResolvedValue(status);
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
    const error = await run(makeReq({ formId: 'f1', authed: true }));
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({ statusCode: 403, message });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ formId: 'f1', submissionId: 's1', reason: status }),
      'Draft save refused',
    );
    warn.mockRestore();
  });

  it('refuses an anonymous caller with 403, not 401', async () => {
    mockStatus.mockResolvedValue('public');
    const error = await run(makeReq({ formId: 'f1' }));
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it('errors when the submit context is missing', async () => {
    const error = await run(makeReq({}));
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ForbiddenError);
    expect(mockStatus).not.toHaveBeenCalled();
  });
});
